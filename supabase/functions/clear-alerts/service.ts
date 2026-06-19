import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type { ClearAlertsResponse } from './types.ts';

const ALERT_WINDOW_DAYS = 7;

export async function clearAlerts(caller: AuthenticatedUser): Promise<ClearAlertsResponse> {
  const supabase = createServiceClient();

  const { data: professional, error: profError } = await supabase
    .from('professionals')
    .select('id, clinic_id')
    .eq('user_id', caller.id)
    .is('deleted_at', null)
    .single();

  if (profError || !professional) {
    throw new AppError({ code: 'NO_ACCESS', message: 'Profissional não encontrado', statusCode: 403 });
  }

  const since = new Date(Date.now() - ALERT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: patients, error: patientsError } = await supabase
    .from('patients')
    .select('id')
    .eq('professional_id', professional.id)
    .eq('status_vinculo', 'ativo')
    .is('deleted_at', null);

  if (patientsError) {
    throw new AppError({ code: 'PATIENTS_FETCH_FAILED', message: patientsError.message, statusCode: 500 });
  }

  const patientIds = (patients ?? []).map((p) => p.id);
  if (patientIds.length === 0) {
    return { dismissed_count: 0, message: 'Nenhum alerta para limpar' };
  }

  const { data: entries, error: entriesError } = await supabase
    .from('diary_entries')
    .select('id')
    .in('patient_id', patientIds)
    .is('deleted_at', null)
    .gte('created_at', since);

  if (entriesError) {
    throw new AppError({ code: 'ENTRIES_FETCH_FAILED', message: entriesError.message, statusCode: 500 });
  }

  const entryIds = (entries ?? []).map((e) => e.id);
  if (entryIds.length === 0) {
    return { dismissed_count: 0, message: 'Nenhum alerta para limpar' };
  }

  const rows = entryIds.map((diary_entry_id) => ({
    professional_id: professional.id,
    diary_entry_id,
    dismissed_at: new Date().toISOString(),
  }));

  const { error: upsertError } = await supabase
    .from('professional_dashboard_dismissals')
    .upsert(rows, { onConflict: 'professional_id,diary_entry_id' });

  if (upsertError) {
    throw new AppError({ code: 'DISMISS_FAILED', message: upsertError.message, statusCode: 500 });
  }

  await supabase.from('audit_logs').insert({
    user_id: caller.id,
    clinic_id: professional.clinic_id,
    action: 'dashboard.alerts_cleared',
    resource_type: 'professional_dashboard_dismissals',
    resource_id: professional.id,
    metadata: { dismissed_count: entryIds.length, window_days: ALERT_WINDOW_DAYS },
  });

  return {
    dismissed_count: entryIds.length,
    message: 'Alertas marcados como lidos',
  };
}
