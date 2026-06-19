import { describe, expect, it } from 'vitest';
import type { PatientSessionRecord } from '../session/session-history.types';
import {
  buildSessionPreview,
  deriveSessionReportBadge,
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
});
