import { createServiceClient } from '../_shared/supabase.ts';
import { assertCanAddPatient } from '../_shared/plan-quotas.ts';
import { assertCanCreatePatientPaywall } from '../_shared/paywall.ts';
import { enforceReactivationCooldown } from '../_shared/reactivation-cooldown-enforce.ts';
import { AppError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type { ReactivatePatientPayload, ReactivatePatientResponse } from './types.ts';

export async function reactivatePatient(
  payload: ReactivatePatientPayload,
  caller: AuthenticatedUser,
): Promise<ReactivatePatientResponse> {
  const supabase = createServiceClient();

  const { data: professional } = await supabase
    .from('professionals')
    .select('id, clinic_id')
    .eq('user_id', caller.id)
    .is('deleted_at', null)
    .single();

  if (!professional) {
    throw new AppError({
      code: 'NOT_A_PROFESSIONAL',
      message: 'O usuário não é um profissional registrado.',
      statusCode: 403,
    });
  }

  const { data: patient, error: fetchError } = await supabase
    .from('patients')
    .select('id, professional_id, clinic_id, status_vinculo, name, data_desvinculacao')
    .eq('id', payload.patient_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (fetchError) {
    throw new AppError({
      code: 'PATIENT_FETCH_FAILED',
      message: fetchError.message,
      statusCode: 500,
    });
  }

  if (!patient || patient.professional_id !== professional.id) {
    throw new AppError({
      code: 'PATIENT_NOT_FOUND',
      message: 'Paciente não encontrado na sua carteira',
      statusCode: 404,
    });
  }

  if (patient.status_vinculo === 'ativo') {
    throw new AppError({
      code: 'ALREADY_ACTIVE',
      message: 'Este paciente já está ativo na sua carteira',
      statusCode: 409,
    });
  }

  if (patient.status_vinculo !== 'desvinculado') {
    throw new AppError({
      code: 'INVALID_STATUS',
      message: 'Status de vínculo inválido para reativação',
      statusCode: 400,
    });
  }

  enforceReactivationCooldown(patient.data_desvinculacao as string | null);

  await assertCanCreatePatientPaywall(professional.clinic_id, professional.id);
  await assertCanAddPatient(professional.clinic_id, professional.id);

  const { error: updateError } = await supabase
    .from('patients')
    .update({
      status_vinculo: 'ativo',
      data_desvinculacao: null,
    })
    .eq('id', payload.patient_id)
    .eq('professional_id', professional.id);

  if (updateError) {
    throw new AppError({
      code: 'REACTIVATE_FAILED',
      message: updateError.message,
      statusCode: 500,
    });
  }

  await supabase.from('audit_logs').insert({
    user_id: caller.id,
    clinic_id: patient.clinic_id,
    action: 'patient.reactivate',
    resource_type: 'patient',
    resource_id: patient.id,
    metadata: { name: patient.name },
  });

  return {
    patient_id: patient.id,
    message: 'Vínculo reativado com sucesso',
  };
}
