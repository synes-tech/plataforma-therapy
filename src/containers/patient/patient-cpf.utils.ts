import { cpfDigitsComplete, isValidCpfFormat, normalizeCpf } from '@shared/lib/cpf';
import type { CpfLookupPhase } from './patient-cpf.types';

export function resolveCpfPhase(maskedCpf: string, searching: boolean): CpfLookupPhase {
  const digits = normalizeCpf(maskedCpf);
  if (digits.length === 0) return 'idle';
  if (digits.length < 11) return 'typing';
  if (!isValidCpfFormat(digits)) return 'invalid';
  if (searching) return 'searching';
  return 'idle';
}

export function shouldTriggerCpfLookup(maskedCpf: string): boolean {
  return cpfDigitsComplete(maskedCpf) && isValidCpfFormat(maskedCpf);
}

export function formatBirthDateBr(iso: string): string {
  if (!iso) return '';
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');
}
