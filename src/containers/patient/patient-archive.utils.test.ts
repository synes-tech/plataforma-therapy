/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { filterArchivedPatients, formatArchiveLicenseLabel } from './patient-archive.utils';
import type { ArchivedPatient } from './patient-archive.types';

const basePatient = {
  birth_date: '2015-03-10',
  diagnoses: ['TEA'] as string[],
  foto_url: null,
  status_vinculo: 'desvinculado',
  created_at: '2024-01-01',
  data_desvinculacao: '2024-06-01',
};

const SAMPLE: ArchivedPatient[] = [
  {
    ...basePatient,
    id: '1',
    name: 'Ana Beatriz Silva',
    cpf_paciente: '52998224725',
    cpf_responsavel: null,
    nome_responsavel: null,
  },
  {
    ...basePatient,
    id: '2',
    name: 'Lucas Oliveira',
    cpf_paciente: null,
    cpf_responsavel: '11144477735',
    nome_responsavel: 'Maria Oliveira',
  },
  {
    ...basePatient,
    id: '3',
    name: 'Pedro Oliveira',
    cpf_paciente: null,
    cpf_responsavel: '11144477735',
    nome_responsavel: 'Maria Oliveira',
  },
];

describe('patient-archive.utils', () => {
  it('filtra por parte do nome', () => {
    expect(filterArchivedPatients(SAMPLE, 'beatriz')).toHaveLength(1);
    expect(filterArchivedPatients(SAMPLE, 'beatriz')[0]?.name).toBe('Ana Beatriz Silva');
  });

  it('filtra por CPF do paciente ou do responsável', () => {
    expect(filterArchivedPatients(SAMPLE, '529.982')).toHaveLength(1);
    expect(filterArchivedPatients(SAMPLE, '11144477735')).toHaveLength(2);
    expect(filterArchivedPatients(SAMPLE, '000')).toHaveLength(0);
  });

  it('filtra por nome do responsável', () => {
    expect(filterArchivedPatients(SAMPLE, 'maria oliveira')).toHaveLength(2);
  });

  it('retorna todos quando busca vazia', () => {
    expect(filterArchivedPatients(SAMPLE, '')).toHaveLength(3);
    expect(filterArchivedPatients(SAMPLE, '   ')).toHaveLength(3);
  });

  it('monta rótulo do contador de licenças', () => {
    expect(formatArchiveLicenseLabel(12, 15)).toBe('Pacientes Arquivados: 12 / 15 licenças em uso');
    expect(formatArchiveLicenseLabel(1, 1)).toBe('Pacientes Arquivados: 1 / 1 licença em uso');
  });
});
