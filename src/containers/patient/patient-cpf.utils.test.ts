/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { isValidCpfFormat } from '@shared/lib/cpf';
import { shouldTriggerCpfLookup } from './patient-cpf.utils';

describe('patient CPF lookup', () => {
  it('não dispara busca antes de 11 dígitos válidos', () => {
    expect(shouldTriggerCpfLookup('123.456.789')).toBe(false);
  });

  it('rejeita CPF inválido antes do backend', () => {
    expect(shouldTriggerCpfLookup('111.111.111-11')).toBe(false);
    expect(isValidCpfFormat('11111111111')).toBe(false);
  });

  it('aceita CPF válido para busca', () => {
    const valid = '111.444.777-35';
    expect(shouldTriggerCpfLookup(valid)).toBe(true);
  });
});
