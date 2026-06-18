import { normalizeCpf } from '@shared/lib/cpf';
import type { ArchivedPatient } from './patient-archive.types';

export function filterArchivedPatients(
  patients: ArchivedPatient[],
  query: string,
): ArchivedPatient[] {
  const trimmed = query.trim();
  if (!trimmed) return patients;

  const lower = trimmed.toLowerCase();
  const cpfDigits = normalizeCpf(trimmed);

  return patients.filter((patient) => {
    if (patient.name.toLowerCase().includes(lower)) return true;
    if (!patient.cpf || cpfDigits.length < 3) return false;
    return patient.cpf.includes(cpfDigits);
  });
}

export function formatArchiveLicenseLabel(inUse: number, licenses: number): string {
  const licenseLabel = licenses === 1 ? 'licença' : 'licenças';
  return `Pacientes Arquivados: ${inUse} / ${licenses} ${licenseLabel} em uso`;
}
