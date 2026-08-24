import { createServiceClient } from '../_shared/supabase.ts';
import { notifyPatientTrialEnding } from '../_shared/b2c-billing-email.ts';

export interface WarnPatientTrialEndingResult {
  scanned: number;
  sent: number;
  skipped: number;
}

/**
 * D6: o Stripe avisa 3 dias antes (`trial_will_end`). Este job cobre o aviso
 * de 1 dia — varre `trial_end` nas próximas 36 horas e marca `trial_warning_sent_at`.
 */
export async function warnPatientTrialEnding(): Promise<WarnPatientTrialEndingResult> {
  const supabase = createServiceClient();
  const now = new Date();
  const horizon = new Date(now.getTime() + 36 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('patient_subscriptions')
    .select('id, user_id, trial_end, patient_id')
    .eq('status', 'trialing')
    .is('trial_warning_sent_at', null)
    .gt('trial_end', now.toISOString())
    .lte('trial_end', horizon.toISOString());

  if (error) {
    throw error;
  }

  const rows = data ?? [];
  let sent = 0;
  let skipped = 0;

  for (const row of rows) {
    const ok = await notifyPatientTrialEnding({
      userId: row.user_id as string | null,
      trialEnd: row.trial_end as string | null,
      daysBefore: 1,
    }).catch((err) => {
      console.error('[warn-patient-trial-ending] SES falhou', row.id, err);
      return false;
    });

    if (!ok) {
      skipped += 1;
      continue;
    }

    await supabase
      .from('patient_subscriptions')
      .update({ trial_warning_sent_at: new Date().toISOString() })
      .eq('id', row.id);
    sent += 1;
  }

  return { scanned: rows.length, sent, skipped };
}
