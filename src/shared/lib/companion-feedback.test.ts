/**
 * Motor de alertas e retroalimentação — ADR-06.
 *
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';

import {
  SEVERE_ALERT_SUMMARY,
  MODERATE_ALERT_SUMMARY,
  alertCopy,
  alertDedupeKey,
  compareClinicalAlerts,
  shouldNotifyNow,
} from '../../../supabase/functions/_shared/companion/alerts.ts';
import {
  findLiteralLeak,
  filterCompanionSummaryChunks,
  previousBrWeekBounds,
  sanitizeCompanionSummary,
  type CompanionTurn,
} from '../../../supabase/functions/_shared/companion/summary-guardrails.ts';

const crisisTurn: CompanionTurn = {
  role: 'user',
  content: 'Não aguento mais, quero sumir do mapa, vou acabar com tudo no trânsito terça.',
  created_at: '2026-08-18T03:12:00.000Z',
};

describe('Alertas clínicos', () => {
  it('nunca coloca a fala do paciente no summary', () => {
    expect(SEVERE_ALERT_SUMMARY).not.toMatch(/quero sumir|matar|acabar com tudo/i);
    expect(MODERATE_ALERT_SUMMARY).not.toMatch(/quero sumir|taquicardia|trânsito/i);
    expect(alertCopy('SEVERE').summary).toContain('188');
    expect(alertCopy('MODERATE').summary).toContain('sofrimento intenso');
  });

  it('agrega por paciente, dia e severidade', () => {
    expect(alertDedupeKey('p1', 'SEVERE', '2026-08-22')).toBe('b2c-severe:p1:2026-08-22');
    expect(alertDedupeKey('p1', 'MODERATE', '2026-08-22')).toBe('b2c-moderate:p1:2026-08-22');
    expect(alertDedupeKey('p1', 'SEVERE', '2026-08-22')).not.toBe(alertDedupeKey('p1', 'MODERATE', '2026-08-22'));
  });

  it('SEVERE sempre notifica; MODERATE só em horário clínico de semana', () => {
    const tuesdayMorning = new Date('2026-08-18T12:00:00.000Z'); // 09:00 BRT
    const tuesdayNight = new Date('2026-08-19T02:00:00.000Z'); // 23:00 BRT segunda
    const saturday = new Date('2026-08-22T15:00:00.000Z');
    expect(shouldNotifyNow('SEVERE', tuesdayNight)).toBe(true);
    expect(shouldNotifyNow('SEVERE', saturday)).toBe(true);
    expect(shouldNotifyNow('MODERATE', tuesdayMorning)).toBe(true);
    expect(shouldNotifyNow('MODERATE', saturday)).toBe(false);
  });

  it('ordena SEVERE na frente do feed', () => {
    const sorted = [
      { severity: 'MODERATE', occurred_at: '2026-08-22T12:00:00.000Z' },
      { severity: 'SEVERE', occurred_at: '2026-08-22T11:00:00.000Z' },
      { severity: 'LOW', occurred_at: '2026-08-22T13:00:00.000Z' },
    ].sort(compareClinicalAlerts);
    expect(sorted[0]?.severity).toBe('SEVERE');
    expect(sorted[1]?.severity).toBe('MODERATE');
  });
});

describe('Resumo consentido', () => {
  it('a semana anterior é segunda–domingo em BRT', () => {
    const week = previousBrWeekBounds(new Date('2026-08-22T15:00:00.000Z'));
    expect(week.start).toBe('2026-08-10');
    expect(week.end).toBe('2026-08-16');
  });

  it('detecta transcrição literal e substitui por texto seguro', () => {
    const leaked = sanitizeCompanionSummary(
      'O paciente disse: "Não aguento mais, quero sumir do mapa, vou acabar com tudo no trânsito terça."',
      [crisisTurn],
    );
    expect(leaked.toLowerCase()).not.toContain('quero sumir do mapa');
    expect(findLiteralLeak([crisisTurn], leaked)).toBeNull();
  });

  it('não vaza o chat cru no RAG se o compartilhamento estiver desligado', () => {
    const chunks = [
      { document_type: 'session_note', content: 'SOAP' },
      { document_type: 'companion_summary', content: 'resumo' },
    ];
    expect(filterCompanionSummaryChunks(chunks, false).map((c) => c.document_type)).toEqual(['session_note']);
    expect(filterCompanionSummaryChunks(chunks, true)).toHaveLength(2);
  });
});
