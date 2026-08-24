/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { classifyTabTone, competenceFromDate } from './classify-tab.utils';

describe('classify-tab.utils', () => {
  it('pinta o item conforme a fila', () => {
    expect(classifyTabTone(0)).toBe('green');
    expect(classifyTabTone(3)).toBe('blue');
    expect(classifyTabTone(10)).toBe('blue');
    expect(classifyTabTone(11)).toBe('amber');
  });

  it('deriva competência pelo dia informado', () => {
    expect(competenceFromDate('2026-07-20')).toBe('2026-07-01');
    expect(competenceFromDate('2026-08-14')).toBe('2026-08-01');
  });
});
