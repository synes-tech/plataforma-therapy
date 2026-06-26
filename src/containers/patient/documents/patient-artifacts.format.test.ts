import { describe, expect, it } from 'vitest';
import {
  buildArtifactTitle,
  formatArtifactDate,
  formatArtifactDateShort,
  resolveArtifactTitle,
  truncateArtifactPreview,
} from './patient-artifacts.format';
import { filterPatientArtifacts } from './patient-artifacts.utils';
import type { PatientArtifact } from './patient-artifacts.types';

const sampleArtifact = (overrides: Partial<PatientArtifact> = {}): PatientArtifact => ({
  id: '1',
  tipo_artefato: 'acao_recomendada',
  titulo: null,
  conteudo_texto: 'Texto de exemplo para o documento salvo pelo copiloto.',
  criado_em: '2026-06-19T14:24:00.000Z',
  is_legacy: false,
  compartilhado_familia: false,
  ...overrides,
});

describe('formatArtifactDate', () => {
  it('formata data em português sem horário', () => {
    expect(formatArtifactDate('2026-06-19T14:24:00.000Z')).toMatch(/19 de Junho de 2026/);
  });

  it('retorna vazio para ISO inválido', () => {
    expect(formatArtifactDate('invalid')).toBe('');
  });
});

describe('formatArtifactDateShort', () => {
  it('formata data curta pt-BR', () => {
    expect(formatArtifactDateShort('2026-06-19T14:24:00.000Z')).toMatch(/19\/06\/2026/);
  });
});

describe('resolveArtifactTitle', () => {
  it('prioriza título customizado quando existir', () => {
    expect(
      resolveArtifactTitle({
        titulo: 'Plano personalizado da família',
        tipo_artefato: 'acao_recomendada',
        criado_em: '2026-06-19T14:24:00.000Z',
      }),
    ).toBe('Plano personalizado da família');
  });
});

describe('buildArtifactTitle', () => {
  it('monta título dinâmico por tipo e data', () => {
    expect(buildArtifactTitle('acao_recomendada', '2026-06-19T14:24:00.000Z')).toMatch(
      /Plano de Ação - 19\/06\/2026/,
    );
    expect(buildArtifactTitle('relatorio_sessao', '2026-06-19T14:24:00.000Z')).toMatch(
      /Relatório -/,
    );
  });
});

describe('truncateArtifactPreview', () => {
  it('trunca conteúdo longo com reticências', () => {
    const long = 'a'.repeat(60);
    expect(truncateArtifactPreview(long, 50)).toHaveLength(53);
    expect(truncateArtifactPreview(long, 50).endsWith('...')).toBe(true);
  });

  it('mantém texto curto intacto', () => {
    expect(truncateArtifactPreview('Texto curto')).toBe('Texto curto');
  });
});

describe('filterPatientArtifacts', () => {
  const items = [
    sampleArtifact({ id: '1', tipo_artefato: 'acao_recomendada' }),
    sampleArtifact({ id: '2', tipo_artefato: 'resumo_proativo' }),
    sampleArtifact({ id: '3', tipo_artefato: 'relatorio_sessao' }),
  ];

  it('retorna todos com filtro todos', () => {
    expect(filterPatientArtifacts(items, 'todos')).toHaveLength(3);
  });

  it('filtra por tipo instantaneamente', () => {
    expect(filterPatientArtifacts(items, 'resumo_proativo')).toHaveLength(1);
    expect(filterPatientArtifacts(items, 'resumo_proativo')[0]?.id).toBe('2');
  });

  it('filtra por busca no título ou conteúdo', () => {
    const withText = [
      sampleArtifact({ id: '1', conteudo_texto: 'Plano de rotina matinal' }),
      sampleArtifact({ id: '2', conteudo_texto: 'Outro documento qualquer' }),
    ];
    expect(filterPatientArtifacts(withText, 'todos', 'rotina')).toHaveLength(1);
    expect(filterPatientArtifacts(withText, 'todos', 'rotina')[0]?.id).toBe('1');
  });
});
