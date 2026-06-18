import { createServiceClient } from './supabase.ts';
import { AppError, ForbiddenError } from './errors.ts';

export interface FamilyPatientLink {
  patient_id: string;
  patient_name: string;
}

/** Resolve paciente vinculado à família. Nunca confia em patient_id vindo do cliente. */
export async function getFamilyPatientLink(userId: string): Promise<FamilyPatientLink> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('patient_family_links')
    .select('patient_id, patients(name)')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new AppError({ code: 'LINK_FETCH_FAILED', message: error.message, statusCode: 500 });
  }

  if (!data) {
    throw new ForbiddenError('Nenhum paciente vinculado a esta conta familiar');
  }

  const row = data as { patient_id: string; patients: { name: string } };
  return { patient_id: row.patient_id, patient_name: row.patients.name };
}

/** Bloqueia acesso se patient_id informado não pertence à família. */
export async function assertFamilyOwnsPatient(userId: string, patientId?: string): Promise<FamilyPatientLink> {
  const link = await getFamilyPatientLink(userId);
  if (patientId && patientId !== link.patient_id) {
    throw new ForbiddenError('Você não tem acesso a este paciente');
  }
  return link;
}
