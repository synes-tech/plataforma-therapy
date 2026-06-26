import { describe, expect, it } from 'vitest';
import { applyPatientListFilters, getPaginationMeta, paginatePatients, resolveFamilyLinkStatus } from './patient-list.utils';
import type { PatientListItem } from './patient-list.types';

const SAMPLE: PatientListItem[] = [
  {
    id: '1',
    name: 'Ana',
    birth_date: '2010-01-01',
    diagnoses: ['TEA'],
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Bruno',
    birth_date: '2000-01-01',
    diagnoses: ['TDAH'],
    status: 'inactive',
    created_at: '2026-02-01T00:00:00Z',
  },
  {
    id: '3',
    name: 'Carla',
    birth_date: '1995-01-01',
    diagnoses: ['Ansiedade'],
    status: 'active',
    created_at: '2026-03-01T00:00:00Z',
  },
];

describe('patient-list.utils', () => {
  it('filtra por status e diagnóstico', () => {
    const result = applyPatientListFilters(SAMPLE, {
      status: 'active',
      diagnosis: 'tea',
      sort: 'name_asc',
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Ana');
  });

  it('pagina 10 itens por página', () => {
    const items = Array.from({ length: 25 }, (_, i) => `p-${i}`);
    const page2 = paginatePatients(items, 2, 10);
    expect(page2).toHaveLength(10);
    expect(page2[0]).toBe('p-10');
  });

  it('calcula metadados de paginação', () => {
    const meta = getPaginationMeta(23, 2, 10);
    expect(meta.totalPages).toBe(3);
    expect(meta.start).toBe(11);
    expect(meta.end).toBe(20);
  });

  it('resolve family link status com fallback pendente', () => {
    expect(
      resolveFamilyLinkStatus({
        id: '1',
        name: 'Ana',
        birth_date: '2010-01-01',
        diagnoses: [],
        status: 'active',
        created_at: '2026-01-01',
      }),
    ).toBe('pendente');
  });
});
