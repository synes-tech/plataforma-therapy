import type { WorkspacePatient } from './copilot-workspace.types';

export function filterWorkspacePatients(
  patients: WorkspacePatient[],
  query: string,
): WorkspacePatient[] {
  const term = query.trim().toLowerCase();
  if (!term) return [];

  return patients.filter((patient) => {
    if (patient.name.toLowerCase().includes(term)) return true;
    return (patient.diagnoses ?? []).some((diagnosis) => diagnosis.toLowerCase().includes(term));
  });
}

export function workspacePatientAgeLabel(birthDate?: string | null): string | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age >= 0 ? `${age} anos` : null;
}
