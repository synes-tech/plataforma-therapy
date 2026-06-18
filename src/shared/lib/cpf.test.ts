/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { formatCpfDisplay, isValidCpfFormat, maskCpfInput, maskPatientName, normalizeCpf } from './cpf';

describe('cpf', () => {
  it('normaliza removendo pontuação', () => {
    expect(normalizeCpf('123.456.789-09')).toBe('12345678909');
  });

  it('formata para exibição', () => {
    expect(formatCpfDisplay('12345678909')).toBe('123.456.789-09');
  });

  it('mascara input progressivamente', () => {
    expect(maskCpfInput('123456')).toBe('123.456');
  });

  it('mascara nome', () => {
    expect(maskPatientName('João Pedro')).toBe('João P***');
  });

  it('rejeita sequência repetida', () => {
    expect(isValidCpfFormat('11111111111')).toBe(false);
  });
});
