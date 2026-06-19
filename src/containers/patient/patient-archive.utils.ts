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
    if (patient.nome_responsavel?.toLowerCase().includes(lower)) return true;
    if (cpfDigits.length < 3) return false;
    if (patient.cpf_paciente?.includes(cpfDigits)) return true;
    if (patient.cpf_responsavel?.includes(cpfDigits)) return true;
    return false;
  });
}

export function formatArchiveLicenseLabel(inUse: number, licenses: number): string {
  const licenseLabel = licenses === 1 ? 'licença' : 'licenças';
  return `Pacientes Arquivados: ${inUse} / ${licenses} ${licenseLabel} em uso`;
}

export function formatPatientIdentityLine(patient: ArchivedPatient): string | null {
  if (patient.cpf_paciente) {
    return `CPF paciente`;
  }
  if (patient.cpf_responsavel) {
    const name = patient.nome_responsavel ? `Resp.: ${patient.nome_responsavel}` : 'Resp.';
    return name;
  }
  return null;
}
