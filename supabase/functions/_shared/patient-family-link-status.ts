import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

export type FamilyLinkStatus = 'vinculado' | 'pendente';

type PatientRow = Record<string, unknown> & { id: string };

/**
 * Marca pacientes com família que validou convite no app (patient_family_links.user_id).
 */
export async function attachFamilyLinkStatus<T extends PatientRow>(
  supabase: SupabaseClient,
  patients: T[],
): Promise<Array<T & { family_link_status: FamilyLinkStatus }>> {
  if (patients.length === 0) return [];

  const patientIds = patients.map((p) => p.id);

  const { data: links, error } = await supabase
    .from('patient_family_links')
    .select('patient_id')
    .in('patient_id', patientIds)
    .not('user_id', 'is', null);

  if (error) {
    console.error(JSON.stringify({ level: 'warn', action: 'family_link_status_fetch_failed', error: error.message }));
    return patients.map((patient) => ({ ...patient, family_link_status: 'pendente' as const }));
  }

  const linkedPatientIds = new Set((links ?? []).map((row) => row.patient_id as string));

  return patients.map((patient) => ({
    ...patient,
    family_link_status: linkedPatientIds.has(patient.id) ? ('vinculado' as const) : ('pendente' as const),
  }));
}
