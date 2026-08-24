import { createServiceClient } from './supabase.ts';
import { AppError, ForbiddenError } from './errors.ts';
import type { PortalAccessLevel } from './patient-profile.ts';

export interface FamilyPatientLink {
  patient_id: string;
  patient_name: string;
  /** Quem está do outro lado: um cuidador observando, ou o próprio paciente. */
  access_level: PortalAccessLevel;
  link_id: string;
  relationship: string;
  is_primary_contact: boolean;
}

interface LinkRow {
  id: string;
  patient_id: string;
  access_level: PortalAccessLevel | null;
  relationship: string | null;
  is_primary_contact: boolean | null;
  patients: { name: string } | { name: string }[];
}

function patientName(row: LinkRow): string {
  const patients = row.patients;
  if (Array.isArray(patients)) return patients[0]?.name ?? 'paciente';
  return patients?.name ?? 'paciente';
}

/**
 * Resolve o paciente vinculado a esta conta de portal. Nunca confia em `patient_id` vindo
 * do cliente.
 *
 * Vínculos revogados são ignorados: revogar acesso precisa ter efeito imediato, e antes
 * desta checagem um cuidador removido continuaria enxergando o paciente.
 */
export async function getFamilyPatientLink(userId: string): Promise<FamilyPatientLink> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('patient_family_links')
    .select('id, patient_id, access_level, relationship, is_primary_contact, patients(name)')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new AppError({ code: 'LINK_FETCH_FAILED', message: error.message, statusCode: 500 });
  }

  if (!data) {
    throw new ForbiddenError('Nenhum paciente vinculado a esta conta');
  }

  const row = data as unknown as LinkRow;
  return {
    patient_id: row.patient_id,
    patient_name: patientName(row),
    access_level: row.access_level ?? 'CAREGIVER',
    link_id: row.id,
    relationship: row.relationship ?? 'responsável',
    is_primary_contact: row.is_primary_contact ?? false,
  };
}

/** Bloqueia acesso se patient_id informado não pertence a esta conta. */
export async function assertFamilyOwnsPatient(userId: string, patientId?: string): Promise<FamilyPatientLink> {
  const link = await getFamilyPatientLink(userId);
  if (patientId && patientId !== link.patient_id) {
    throw new ForbiddenError('Você não tem acesso a este paciente');
  }
  return link;
}
