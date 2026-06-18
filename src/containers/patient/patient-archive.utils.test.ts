/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { filterArchivedPatients, formatArchiveLicenseLabel } from './patient-archive.utils';
import type { ArchivedPatient } from './patient-archive.types';

const SAMPLE: ArchivedPatient[] = [
  {
    id: '1',
    name: 'Ana Beatriz Silva',
    birth_date: '2015-03-10',
    diagnoses: ['TEA'],
    cpf: '52998224725',
    created_at: '2024-01-01',
  },
  {
    id: '2',
    name: 'Lucas Oliveira',
    birth_date: '2012-08-22',
    diagnoses: ['TDAH'],
    cpf: '11144477735',
    created_at: '2024-02-01',
  },
];

describe('patient-archive.utils', () => {
  it('filtra por parte do nome', () => {
    expect(filterArchivedPatients(SAMPLE, 'beatriz')).toHaveLength(1);
    expect(filterArchivedPatients(SAMPLE, 'beatriz')[0]?.name).toBe('Ana Beatriz Silva');
  });

  it('filtra por CPF parcial ou completo', () => {
    expect(filterArchivedPatients(SAMPLE, '529.982')).toHaveLength(1);
    expect(filterArchivedPatients(SAMPLE, '11144477735')).toHaveLength(1);
    expect(filterArchivedPatients(SAMPLE, '000')).toHaveLength(0);
  });

  it('retorna todos quando busca vazia', () => {
    expect(filterArchivedPatients(SAMPLE, '')).toHaveLength(2);
    expect(filterArchivedPatients(SAMPLE, '   ')).toHaveLength(2);
  });

  it('monta rótulo do contador de licenças', () => {
    expect(formatArchiveLicenseLabel(12, 15)).toBe('Pacientes Arquivados: 12 / 15 licenças em uso');
    expect(formatArchiveLicenseLabel(1, 1)).toBe('Pacientes Arquivados: 1 / 1 licença em uso');
  });
});

describe('separação ativos vs arquivados', () => {
  it('filtro não inclui pacientes fora da lista arquivada', () => {
    const archivedOnly = SAMPLE;
    const result = filterArchivedPatients(archivedOnly, 'lucas');
    expect(result.every((p) => archivedOnly.some((a) => a.id === p.id))).toBe(true);
    expect(result).not.toContainEqual(expect.objectContaining({ name: 'Paciente Ativo' }));
  });
});
