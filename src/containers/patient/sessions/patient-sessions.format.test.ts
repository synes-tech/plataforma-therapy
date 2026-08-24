import { describe, expect, it } from 'vitest';
import type { PatientSessionRecord } from '../session/session-history.types';
import {
  buildSessionPreview,
  deriveSessionReportBadge,
  resolveSessionSavedArtifactId,
  sessionSavedReportPath,
  truncateSessionPreview,
} from './patient-sessions.format';

function sampleSession(overrides: Partial<PatientSessionRecord> = {}): PatientSessionRecord {
  return {
    id: '1',
    paciente_id: 'p1',
    data_sessao: '2026-06-01T14:00:00Z',
    status_nota: 'approved',
    audio_url: null,
    audio_mime_type: null,
    audio_duracao_segundos: null,
    transcricao_completa: null,
    resumo_ia: {
      subjective: 'Paciente engajado e colaborativo.',
      objective: '',
      assessment: 'Boa evolução no plano terapêutico.',
      plan: '',
    },
    ...overrides,
  };
}

describe('patient-sessions.format', () => {
  it('trunca preview longo', () => {
    const text = 'a'.repeat(120);
    expect(truncateSessionPreview(text, 90).endsWith('…')).toBe(true);
  });

  it('deriva badge de boa sessão', () => {
    const badge = deriveSessionReportBadge(sampleSession());
    expect(badge.label).toBe('Boa sessão');
  });

  it('deriva badge de processamento para rascunho', () => {
    const badge = deriveSessionReportBadge(sampleSession({ status_nota: 'draft' }));
    expect(badge.label).toBe('Processando');
  });

  it('monta preview a partir do subjetivo', () => {
    expect(buildSessionPreview(sampleSession())).toContain('engajado');
  });

  it('resolve o artefato salvo da sessão', () => {
    expect(sessionSavedReportPath('p1', 'art-9')).toBe('/patients/p1/documents?artifact=art-9');
    expect(
      resolveSessionSavedArtifactId(sampleSession({ saved_artifact_id: 'art-1' }), []),
    ).toBe('art-1');
    expect(
      resolveSessionSavedArtifactId(sampleSession(), [
        {
          id: 'art-2',
          tipo_artefato: 'relatorio_sessao',
          titulo: null,
          conteudo_texto: 'Relatório',
          criado_em: '2026-06-01T14:00:00Z',
          is_legacy: false,
          compartilhado_familia: false,
          session_note_id: '1',
        },
      ]),
    ).toBe('art-2');
    expect(
      resolveSessionSavedArtifactId(
        sampleSession(),
        [
          {
            id: 'art-3',
            tipo_artefato: 'relatorio_sessao',
            titulo: 'Relatório da sessão de 01/06/2026 — Ana',
            conteudo_texto: 'Relatório',
            criado_em: '2026-06-01T14:00:00Z',
            is_legacy: false,
            compartilhado_familia: false,
          },
        ],
        'Ana',
      ),
    ).toBe('art-3');
  });
});
