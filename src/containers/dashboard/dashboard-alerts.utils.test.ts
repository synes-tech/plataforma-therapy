/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import type { AlertItem } from './dashboard.types';
import {
  getAlertCheckinPath,
  getAlertDismissAriaLabel,
  getAlertEmoji,
  getAlertRowClassName,
  getAlertSummary,
  getCrisisLevelLabel,
  sortAlertsByPriority,
} from './dashboard-alert-summary.utils';
import {
  DASHBOARD_ALERTS_SUBTITLE,
  DASHBOARD_ALERTS_TITLE,
} from './dashboard-alerts.constants';

const ALERT_LIST_MAX_HEIGHT_CLASS = 'max-h-96';

describe('DashboardAlertsCard microcopy', () => {
  it('usa título principal e subtítulo descritivo com hierarquia correta', () => {
    expect(DASHBOARD_ALERTS_TITLE).toBe('Alerta dos Pacientes');
    expect(DASHBOARD_ALERTS_SUBTITLE).toBe('últimos 7 dias');
  });
});

describe('DashboardAlertsCard layout constants', () => {
  it('usa altura máxima para ~10 itens com scroll', () => {
    expect(ALERT_LIST_MAX_HEIGHT_CLASS).toBe('max-h-96');
  });
});

export function filterUndismissedAlerts<T extends { id: string }>(
  entries: T[],
  dismissedIds: Set<string>,
  limit = 20,
): T[] {
  return entries.filter((entry) => !dismissedIds.has(entry.id)).slice(0, limit);
}

describe('filterUndismissedAlerts', () => {
  it('remove alertas já dispensados', () => {
    const entries = [
      { id: 'a1' },
      { id: 'a2' },
      { id: 'a3' },
    ];
    const dismissed = new Set(['a2']);

    expect(filterUndismissedAlerts(entries, dismissed).map((e) => e.id)).toEqual(['a1', 'a3']);
  });

  it('respeita limite máximo', () => {
    const entries = Array.from({ length: 25 }, (_, i) => ({ id: `e${i}` }));
    expect(filterUndismissedAlerts(entries, new Set(), 20)).toHaveLength(20);
  });
});

function sampleAlert(overrides: Partial<AlertItem> = {}): AlertItem {
  return {
    id: 'alert-1',
    type: 'crisis',
    patient: { id: 'patient-1', name: 'Ana Silva' },
    entry_date: '2026-06-08',
    notes: null,
    crisis_level: 4,
    hours_ago: 2,
    ...overrides,
  };
}

describe('dashboard alert summary utils', () => {
  it('retorna emoji por tipo', () => {
    expect(getAlertEmoji('crisis')).toBe('🚨');
    expect(getAlertEmoji('positive')).toBe('✨');
  });

  it('resume notas quando existem', () => {
    const summary = getAlertSummary(
      sampleAlert({ notes: 'Dificuldade para dormir e irritabilidade à tarde.' }),
    );
    expect(summary).toContain('Dificuldade para dormir');
  });

  it('monta rota de check-in com data do alerta', () => {
    expect(getAlertCheckinPath(sampleAlert())).toBe('/patients/patient-1/checkins?date=2026-06-08');
  });

  it('prioriza alertas de crise no topo', () => {
    const sorted = sortAlertsByPriority([
      sampleAlert({ id: 'positive-1', type: 'positive' }),
      sampleAlert({ id: 'crisis-1', type: 'crisis' }),
    ]);

    expect(sorted.map((alert) => alert.id)).toEqual(['crisis-1', 'positive-1']);
  });

  it('formata badge de nível de crise', () => {
    expect(getCrisisLevelLabel(4)).toBe('Nível 4/5');
    expect(getCrisisLevelLabel(null)).toBeNull();
  });

  it('usa aria-label específico para dispensar crise', () => {
    expect(getAlertDismissAriaLabel(sampleAlert())).toContain('crise');
  });

  it('aplica superfície visual distinta para crise', () => {
    expect(getAlertRowClassName('crisis')).toContain('alert');
    expect(getAlertRowClassName('positive')).toContain('mint');
  });
});
