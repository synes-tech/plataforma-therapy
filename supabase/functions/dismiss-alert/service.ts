import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type { DismissAlertResponse } from './types.ts';

export async function dismissAlert(
  caller: AuthenticatedUser,
  diaryEntryId: string,
): Promise<DismissAlertResponse> {
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

  const { data: entry, error: entryError } = await supabase
    .from('diary_entries')
    .select('id, patient_id, deleted_at')
    .eq('id', diaryEntryId)
    .maybeSingle();

  if (entryError) {
    throw new AppError({ code: 'ENTRY_FETCH_FAILED', message: entryError.message, statusCode: 500 });
  }

  if (!entry || entry.deleted_at) {
    throw new AppError({ code: 'NOT_FOUND', message: 'Alerta não encontrado', statusCode: 404 });
  }

  const { data: patient, error: patientError } = await supabase
    .from('patients')
    .select('id')
    .eq('id', entry.patient_id)
    .eq('professional_id', professional.id)
    .eq('status_vinculo', 'ativo')
    .is('deleted_at', null)
    .maybeSingle();

  if (patientError) {
    throw new AppError({ code: 'PATIENT_FETCH_FAILED', message: patientError.message, statusCode: 500 });
  }

  if (!patient) {
    throw new AppError({ code: 'FORBIDDEN', message: 'Sem permissão para dispensar este alerta', statusCode: 403 });
  }

  const { error: upsertError } = await supabase
    .from('professional_dashboard_dismissals')
    .upsert(
      {
        professional_id: professional.id,
        diary_entry_id: diaryEntryId,
        dismissed_at: new Date().toISOString(),
      },
      { onConflict: 'professional_id,diary_entry_id' },
    );

  if (upsertError) {
    throw new AppError({ code: 'DISMISS_FAILED', message: upsertError.message, statusCode: 500 });
  }

  await supabase.from('audit_logs').insert({
    user_id: caller.id,
    clinic_id: professional.clinic_id,
    action: 'dashboard.alert_dismissed',
    resource_type: 'professional_dashboard_dismissals',
    resource_id: diaryEntryId,
    metadata: { patient_id: entry.patient_id },
  });

  return {
    dismissed: true,
    diary_entry_id: diaryEntryId,
    message: 'Alerta marcado como lido',
  };
}
