import { createServiceClient } from '../_shared/supabase.ts';
import { QuotaExceededError, AppError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type { CreatePatientPayload, CreatePatientResponse } from './types.ts';

export async function createPatient(
  payload: CreatePatientPayload,
  caller: AuthenticatedUser,
  _token: string,
): Promise<CreatePatientResponse> {
  const supabase = createServiceClient();

  // 1. Get professional record for current user
  const { data: professional } = await supabase
    .from('professionals')
    .select('id, clinic_id')
    .eq('user_id', caller.id)
    .is('deleted_at', null)
    .single();

  if (!professional) {
    throw new AppError({ code: 'NOT_A_PROFESSIONAL', message: 'O usuário não é um profissional registrado.', statusCode: 403 });
  }

  const clinicId = professional.clinic_id;

  // 2. Check patient quota
  const { data: settings } = await supabase
    .from('clinic_settings')
    .select('max_patients_per_professional')
    .eq('clinic_id', clinicId)
    .single();

  // Check if professional has an override
  const { data: profData } = await supabase
    .from('professionals')
    .select('max_patients_override')
    .eq('id', professional.id)
    .single();

  const maxPatients = profData?.max_patients_override ?? settings?.max_patients_per_professional ?? 30;

  const { count: currentPatients } = await supabase
    .from('patients')
    .select('id', { count: 'exact', head: true })
    .eq('professional_id', professional.id)
    .is('deleted_at', null);

  if ((currentPatients ?? 0) >= maxPatients) {
    throw new QuotaExceededError('pacientes');
  }

  // 3. Create patient
  const { data: patient, error } = await supabase
    .from('patients')
    .insert({
      clinic_id: clinicId,
      professional_id: professional.id,
      name: payload.name,
      birth_date: payload.birth_date,
      gender: payload.gender ?? 'not_informed',
      diagnoses: payload.diagnoses,
      clinical_observations: payload.clinical_observations ?? null,
      status: 'active',
      created_by: caller.id,
    })
    .select('id')
    .single();

  if (error || !patient) {
    throw new AppError({
      code: 'PATIENT_CREATE_FAILED',
      message: error?.message ?? 'Falha ao criar paciente',
      statusCode: 500,
    });
  }

  // 4. Audit log
  await supabase.from('audit_logs').insert({
    user_id: caller.id,
    clinic_id: clinicId,
    action: 'patient.create',
    resource_type: 'patient',
    resource_id: patient.id,
    metadata: { diagnoses: payload.diagnoses },
  });

  return {
    patient_id: patient.id,
    message: 'Paciente cadastrado com sucesso',
  };
}
