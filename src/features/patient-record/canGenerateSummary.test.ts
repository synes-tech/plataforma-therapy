import { describe, expect, it } from 'vitest';
import { canGenerateSummary } from './canGenerateSummary';

describe('canGenerateSummary', () => {
  it('retorna false quando não há sessões nem observações clínicas', () => {
    expect(canGenerateSummary(0, false)).toBe(false);
  });

  it('retorna true quando há ao menos uma sessão', () => {
    expect(canGenerateSummary(1, false)).toBe(true);
    expect(canGenerateSummary(100, false)).toBe(true);
  });

  it('retorna true quando há observações clínicas mesmo sem sessões', () => {
    expect(canGenerateSummary(0, true)).toBe(true);
  });

  it('retorna true quando há sessões e observações', () => {
    expect(canGenerateSummary(5, true)).toBe(true);
  });
});
