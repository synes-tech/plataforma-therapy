import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import { sendSessionEmailNow } from '../_shared/session-email-jobs.ts';
import type { SessionEmailKind } from '../_shared/session-email-templates.ts';
import type { SessionEmailRecipientRole } from '../_shared/session-email-recipients.ts';

export function assertCronAuth(req: Request): void {
  const expected = Deno.env.get('CRON_SECRET');
  const provided = req.headers.get('X-Cron-Secret');
  if (!expected || !provided || provided !== expected) {
    throw new AppError({
      code: 'UNAUTHORIZED',
      message: 'Cron secret inválido',
      statusCode: 401,
    });
  }
}

interface QueueJobRow {
  id: string;
  schedule_id: string;
  patient_id: string;
  kind: SessionEmailKind;
  recipient_email: string;
  recipient_name: string;
  recipient_role: SessionEmailRecipientRole;
  attempts: number;
  max_attempts: number;
}

export async function processSessionEmailQueue(limit: number): Promise<{
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
}> {
  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();

  const { data: jobs, error } = await supabase
    .from('session_email_jobs')
    .select('id, schedule_id, patient_id, kind, recipient_email, recipient_name, recipient_role, attempts, max_attempts')
    .eq('status', 'pending')
    .is('deleted_at', null)
    .lte('send_at', nowIso)
    .order('send_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new AppError({
      code: 'QUEUE_FETCH_FAILED',
      message: error.message,
      statusCode: 500,
    });
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const job of (jobs ?? []) as QueueJobRow[]) {
    const { data: claimed } = await supabase
      .from('session_email_jobs')
      .update({ status: 'processing', attempts: job.attempts + 1 })
      .eq('id', job.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();

    if (!claimed) {
      skipped += 1;
      continue;
    }

    const { data: session } = await supabase
      .from('therapist_schedule')
      .select('id, scheduled_at, duration_minutes, status, professional_id, deleted_at')
      .eq('id', job.schedule_id)
      .maybeSingle();

    if (
      !session ||
      session.deleted_at ||
      ['completed', 'cancelled', 'canceled', 'no_show', 'not_completed'].includes(session.status as string)
    ) {
      await supabase
        .from('session_email_jobs')
        .update({
          status: 'cancelled',
          last_error: 'Sessão não elegível para lembrete',
        })
        .eq('id', job.id);
      skipped += 1;
      continue;
    }

    const [{ data: patient }, { data: professional }] = await Promise.all([
      supabase.from('patients').select('name').eq('id', job.patient_id).maybeSingle(),
      supabase.from('professionals').select('name').eq('id', session.professional_id).maybeSingle(),
    ]);

    try {
      await sendSessionEmailNow({
        kind: job.kind,
        recipient: {
          email: job.recipient_email,
          name: job.recipient_name || 'Contato',
          role: job.recipient_role,
        },
        patientName: (patient?.name as string) || 'paciente',
        professionalName: (professional?.name as string) || 'terapeuta',
        sessionAtIso: session.scheduled_at as string,
        durationMinutes: session.duration_minutes ? Number(session.duration_minutes) : null,
        audience: job.recipient_role === 'professional' ? 'professional' : 'contact',
      });

      await supabase
        .from('session_email_jobs')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('id', job.id);

      sent += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha no envio SES';
      const nextStatus = job.attempts + 1 >= job.max_attempts ? 'failed' : 'pending';
      await supabase
        .from('session_email_jobs')
        .update({
          status: nextStatus,
          last_error: message,
        })
        .eq('id', job.id);
      failed += 1;
    }
  }

  return {
    processed: (jobs ?? []).length,
    sent,
    failed,
    skipped,
  };
}
