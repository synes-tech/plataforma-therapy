/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { formatSavedRecommendationDate } from './saved-recommendations.format';

describe('formatSavedRecommendationDate', () => {
  it('formata data e hora em português elegante', () => {
    const formatted = formatSavedRecommendationDate('2026-06-18T14:24:00.000Z');
    expect(formatted).toMatch(/18 de Junho de 2026/);
    expect(formatted).toContain('•');
  });

  it('retorna string vazia para ISO inválido', () => {
    expect(formatSavedRecommendationDate('invalid')).toBe('');
  });
});
