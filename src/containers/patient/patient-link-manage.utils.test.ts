/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { namesMatchForDelete, normalizeNameForConfirm } from './patient-link-manage.utils';

describe('patient-link-manage.utils', () => {
  it('normaliza espaços e caixa', () => {
    expect(normalizeNameForConfirm('  Ana   Silva ')).toBe('ana silva');
  });

  it('exige nome exato para hard delete', () => {
    expect(namesMatchForDelete('Ana Silva', 'Ana Silva')).toBe(true);
    expect(namesMatchForDelete('ana silva', 'Ana Silva')).toBe(true);
    expect(namesMatchForDelete('Ana', 'Ana Silva')).toBe(false);
    expect(namesMatchForDelete('111.111.111-11', 'Ana Silva')).toBe(false);
  });
});
