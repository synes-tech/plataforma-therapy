import { normalizeCpf } from './cpf.ts';

const CPF_DIGITS_LEN = 11;

export function normalizePatientSearchTerm(raw: string): { term: string; isCpf: boolean; cpfDigits: string } {
  const term = raw.trim();
  const cpfDigits = normalizeCpf(term);
  const isCpf = cpfDigits.length === CPF_DIGITS_LEN;
  return { term, isCpf, cpfDigits };
}

export function buildPatientSearchOrFilter(term: string, isCpf: boolean, cpfDigits: string): string {
  if (isCpf) {
    return `cpf_paciente.eq.${cpfDigits},cpf_responsavel.eq.${cpfDigits}`;
  }
  const escaped = term.replace(/%/g, '\\%').replace(/_/g, '\\_');
  return `name.ilike.%${escaped}%`;
}

export function matchFieldForPatient(
  cpfDigits: string,
  row: { cpf_paciente?: string | null; cpf_responsavel?: string | null },
): 'cpf_paciente' | 'cpf_responsavel' {
  if (row.cpf_paciente === cpfDigits) return 'cpf_paciente';
  return 'cpf_responsavel';
}
