import { describe, expect, it } from 'vitest';
import { formatArtifactDate } from './patient-artifacts.format';

describe('formatArtifactDate', () => {
  it('formata data em português sem horário', () => {
    expect(formatArtifactDate('2026-06-19T14:24:00.000Z')).toMatch(/19 de Junho de 2026/);
  });

  it('retorna vazio para ISO inválido', () => {
    expect(formatArtifactDate('invalid')).toBe('');
  });
});
