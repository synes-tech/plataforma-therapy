import { createServiceClient } from '../_shared/supabase.ts';
import { notifyBillingTrialEnding24h } from '../_shared/billing-email.ts';
import { clinicTrialIn24hWindow } from '../_shared/clinic-trial-warning.ts';

export interface WarnClinicTrialEndingResult {
  scanned: number;
  sent: number;
  skipped: number;
}

/**
 * Aviso SES 24h antes do fim do trial B2B (dia 13 dos 14).
 * O Stripe nativo dispara trial_will_end ~3 dias antes; este job cobre o D-1.
 */
export async function warnClinicTrialEnding(now: Date = new Date()): Promise<WarnClinicTrialEndingResult> {
  const supabase = createServiceClient();
  const horizon = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('clinics')
    .select('id, subscription_plan, trial_ends_at')
    .eq('subscription_status', 'trial_active')
    .is('deleted_at', null)
    .is('trial_ending_email_sent_at', null)
    .gt('trial_ends_at', now.toISOString())
    .lte('trial_ends_at', horizon.toISOString());

  if (error) throw error;

  const rows = data ?? [];
  let sent = 0;
  let skipped = 0;

  for (const row of rows) {
    const trialEndsAt = row.trial_ends_at ? new Date(row.trial_ends_at as string) : null;
    if (!trialEndsAt || Number.isNaN(trialEndsAt.getTime()) || !clinicTrialIn24hWindow(trialEndsAt, now)) {
      skipped += 1;
      continue;
    }

    const ok = await notifyBillingTrialEnding24h({
      clinicId: row.id as string,
      planId: (row.subscription_plan as string) ?? 'standard',
      trialEndsAt: trialEndsAt.toISOString(),
    }).catch((err) => {
      console.error('[warn-clinic-trial-ending] SES falhou', row.id, err);
      return false;
    });

    if (!ok) {
      skipped += 1;
      continue;
    }

    await supabase
      .from('clinics')
      .update({ trial_ending_email_sent_at: now.toISOString() })
      .eq('id', row.id);
    sent += 1;
  }

  return { scanned: rows.length, sent, skipped };
}
