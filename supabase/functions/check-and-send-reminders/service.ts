import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ForbiddenError } from '../_shared/errors.ts';
import {
  buildDiaryReminderMessage,
  dayKeyUtc,
  reminderVariantSeed,
} from '../_shared/push-messages.ts';
import { isExpiredPushEndpoint, sendWebPush } from '../_shared/web-push.ts';
import type { CheckRemindersPayload, CheckRemindersResponse } from './types.ts';

interface ReminderRow {
  user_id: string;
  patient_id: string;
  patient_name: string;
  last_entry_date: string | null;
  subscription_id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
}

export function assertCronAuth(req: Request): void {
  const expected = Deno.env.get('CRON_SECRET');
  const provided = req.headers.get('X-Cron-Secret');

  if (!expected || !provided || provided !== expected) {
    throw new ForbiddenError('Cron não autorizado');
  }
}

export async function checkAndSendReminders(
  payload: CheckRemindersPayload,
): Promise<CheckRemindersResponse> {
  const supabase = createServiceClient();
  const staleDays = payload.stale_after_days ?? 2;
  const dayKey = dayKeyUtc();

  const { data: rows, error } = await supabase.rpc('get_families_needing_diary_reminder', {
    p_stale_after_days: staleDays,
  });

  if (error) {
    throw new AppError({
      code: 'REMINDER_QUERY_FAILED',
      message: error.message,
      statusCode: 500,
    });
  }

  const targets = (rows ?? []) as ReminderRow[];
  let sent = 0;
  let failed = 0;
  let removedExpired = 0;

  for (const row of targets) {
    const variant = reminderVariantSeed(row.user_id, row.patient_id, dayKey);
    const { title, body } = buildDiaryReminderMessage(row.patient_name, variant);

    try {
      await sendWebPush(
        {
          endpoint: row.endpoint,
          p256dh: row.p256dh,
          auth_key: row.auth_key,
        },
        {
          title,
          body,
          url: '/family/diary',
          tag: `diary-reminder-${row.patient_id}`,
        },
      );

      await supabase.from('push_reminder_log').insert({
        user_id: row.user_id,
        patient_id: row.patient_id,
        subscription_id: row.subscription_id,
        message_title: title,
        message_body: body,
        success: true,
      });

      sent += 1;
    } catch (err) {
      failed += 1;
      const expired = isExpiredPushEndpoint(err);

      if (expired) {
        await supabase.from('push_subscriptions').delete().eq('id', row.subscription_id);
        removedExpired += 1;
      }

      await supabase.from('push_reminder_log').insert({
        user_id: row.user_id,
        patient_id: row.patient_id,
        subscription_id: row.subscription_id,
        message_title: title,
        message_body: body,
        success: false,
        error_code: expired ? 'endpoint_expired' : 'send_failed',
      });

      console.log(JSON.stringify({
        level: 'warn',
        action: 'push_reminder_failed',
        user_id: row.user_id,
        patient_id: row.patient_id,
        expired,
        error: String(err),
      }));
    }
  }

  console.log(JSON.stringify({
    level: 'info',
    action: 'push_reminders_completed',
    scanned: targets.length,
    sent,
    failed,
    removed_expired: removedExpired,
  }));

  return {
    scanned: targets.length,
    sent,
    failed,
    removed_expired: removedExpired,
  };
}
