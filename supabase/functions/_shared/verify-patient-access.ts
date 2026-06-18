import { createServiceClient } from './supabase.ts';
import { AppError, ForbiddenError } from './errors.ts';
import type { AuthenticatedUser } from './auth.ts';

export interface PatientAccessContext {
  patient_id: string;
  professional_id: string;
  clinic_id: string;
}

export async function verifyPatientAccess(
  patientId: string,
  caller: AuthenticatedUser,
): Promise<PatientAccessContext> {
  const supabase = createServiceClient();

  const { data: patient } = await supabase
    .from('patients')
    .select('id, professional_id, clinic_id')
    .eq('id', patientId)
    .is('deleted_at', null)
    .single();

  if (!patient) {
    throw new AppError({ code: 'PATIENT_NOT_FOUND', message: 'Paciente não encontrado', statusCode: 404 });
  }

  if (caller.role === 'professional') {
    const { data: professional } = await supabase
      .from('professionals')
      .select('id')
      .eq('user_id', caller.id)
      .eq('id', patient.professional_id)
      .is('deleted_at', null)
      .single();

    if (!professional) {
      throw new ForbiddenError('Você não tem acesso a este paciente');
    }
  } else if (caller.role === 'clinic_admin') {
    if (caller.clinic_id !== patient.clinic_id) {
      throw new ForbiddenError('Paciente não pertence à sua clínica');
    }
  }

  return {
    patient_id: patient.id,
    professional_id: patient.professional_id,
    clinic_id: patient.clinic_id,
  };
}

export async function verifyProfessionalPatientWrite(
  patientId: string,
  caller: AuthenticatedUser,
): Promise<PatientAccessContext & { caller_professional_id: string }> {
  const ctx = await verifyPatientAccess(patientId, caller);

  if (caller.role !== 'professional' && caller.role !== 'master') {
    throw new ForbiddenError('Apenas o terapeuta responsável pode salvar recomendações');
  }

  const supabase = createServiceClient();
  const { data: professional } = await supabase
    .from('professionals')
    .select('id')
    .eq('user_id', caller.id)
    .is('deleted_at', null)
    .single();

  if (caller.role === 'professional' && (!professional || professional.id !== ctx.professional_id)) {
    throw new ForbiddenError('Você não tem acesso a este paciente');
  }

  return {
    ...ctx,
    caller_professional_id: professional?.id ?? ctx.professional_id,
  };
}
