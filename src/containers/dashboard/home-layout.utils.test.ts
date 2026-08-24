/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import type { BriefingData } from './dashboard.types';
import { withSummaryDefaults } from './home.utils';
import {
  HOME_AGENDA_EMPTY,
  HOME_ATTENTION_EMPTY,
  HOME_SPLIT_LIST_PX,
  HOME_SPLIT_VISIBLE_ROWS,
  attendanceAxisCaption,
  attendanceLegendLabel,
  attendancePeriodTotalLabel,
  attendanceRangeDescription,
  attendanceRangeHint,
  attendanceSeries,
  completedSessionItems,
  completedSessionsToday,
  completedSessionsTotal,
  completedStatusLabel,
  denseBarLabelStep,
  financeNetCents,
  financeReceivableCents,
  quotaBarLabel,
  quotaBarPercent,
  scheduledSessionsToday,
  todaySessionsRatioLabel,
} from './home-layout.utils';

function briefing(overrides: Partial<BriefingData> = {}): BriefingData {
  return {
    professional: { id: 'pro', name: 'João' },
    date: '2026-08-24',
    schedule: [],
    alerts: [],
    summary: withSummaryDefaults(),
    week_days: [{ date: '2026-08-24', label: 'seg', count: 2 }],
    month_days: [{ date: '2026-08-01', label: '1', count: 1 }],
    year_months: [{ date: '2026-08', label: 'ago', count: 8 }],
    completed_sessions: {
      total: 12,
      today: 1,
      ai_processed: 4,
      items_total: [
        {
          id: 'n1',
          patient_id: 'p1',
          patient_name: 'Ana',
          occurred_at: '2026-08-20T10:00:00-03:00',
          status: 'approved',
          source: 'note',
        },
      ],
      items_today: [
        {
          id: 'n2',
          patient_id: 'p1',
          patient_name: 'Ana',
          occurred_at: '2026-08-24T09:00:00-03:00',
          status: 'completed',
          source: 'schedule',
        },
      ],
    },
    finance: {
      received_cents: 100000,
      receivable_cents: 20000,
      overdue_cents: 5000,
      overdue_count: 1,
      classify_count: 0,
      classify_cents: 0,
      expenses_cents: 30000,
      net_cents: 70000,
    },
    ...overrides,
  };
}

describe('home layout — listas e cota', () => {
  it('reserva altura para 5 linhas visíveis', () => {
    expect(HOME_SPLIT_VISIBLE_ROWS).toBe(5);
    expect(HOME_SPLIT_LIST_PX).toBe(440);
  });

  it('usa as mensagens vazias pedidas na home', () => {
    expect(HOME_AGENDA_EMPTY).toContain('agendas de hoje');
    expect(HOME_ATTENTION_EMPTY).toContain('alertas');
  });

  it('mostra a barra da cota e o rótulo ilimitado', () => {
    expect(quotaBarPercent(1, 10)).toBe(10);
    expect(quotaBarLabel(1, 10, false)).toBe('1/10');
    expect(quotaBarLabel(1, 0, true)).toContain('sem limite');
  });
});

describe('home layout — atendimentos', () => {
  it('escolhe a série conforme o filtro', () => {
    const data = briefing();
    expect(attendanceSeries(data, 'week')[0]?.label).toBe('seg');
    expect(attendanceSeries(data, 'month')[0]?.label).toBe('1');
    expect(attendanceSeries(data, 'year')[0]?.label).toBe('ago');
    expect(attendanceRangeHint('month')).toContain('deste mês');
    expect(attendanceRangeHint('week')).toContain('sessões na sua agenda');
    expect(attendanceRangeDescription('week')).toContain('Cancelamentos');
    expect(attendanceAxisCaption('year').x).toContain('mês do ano');
    expect(attendanceLegendLabel()).toContain('agendadas');
    expect(attendancePeriodTotalLabel(1)).toBe('1 sessão no período');
    expect(attendancePeriodTotalLabel(12)).toBe('12 sessões no período');
  });

  it('espaça rótulos quando o mês tem muitos dias', () => {
    expect(denseBarLabelStep(7)).toBe(1);
    expect(denseBarLabelStep(31)).toBe(3);
  });
});

describe('home layout — sessões e financeiro', () => {
  it('lê totais e listas do briefing', () => {
    const data = briefing();
    expect(completedSessionsTotal(data)).toBe(12);
    expect(completedSessionsToday(data)).toBe(1);
    expect(scheduledSessionsToday(data)).toBe(0);
    expect(
      scheduledSessionsToday(
        briefing({ summary: withSummaryDefaults({ sessions_today: 4 }) }),
      ),
    ).toBe(4);
    expect(
      scheduledSessionsToday(
        briefing({
          schedule: [
            {
              id: 's1',
              title: null,
              scheduled_at: '2026-08-24T10:00:00-03:00',
              duration_minutes: 50,
              status: 'scheduled',
              patient: { id: 'p1', name: 'Ana' },
            },
          ],
        }),
      ),
    ).toBe(1);
    expect(todaySessionsRatioLabel(0, 4)).toBe('0/4');
    expect(todaySessionsRatioLabel(2, 5)).toBe('2/5');
    expect(completedSessionItems(data, 'today')).toHaveLength(1);
    expect(completedStatusLabel('approved')).toBe('Evolução aprovada');
  });

  it('cai para o summary quando a lista ainda não veio', () => {
    expect(
      completedSessionsTotal(
        briefing({
          completed_sessions: undefined,
          summary: withSummaryDefaults({ sessions_completed_total: 9 }),
        }),
      ),
    ).toBe(9);
  });

  it('usa o líquido do backend e o a receber', () => {
    const data = briefing();
    expect(financeReceivableCents(data)).toBe(20000);
    expect(financeNetCents(data)).toBe(70000);
  });

  it('calcula o líquido se o campo novo ainda não existir', () => {
    expect(
      financeNetCents(
        briefing({
          finance: {
            received_cents: 80000,
            overdue_cents: 0,
            overdue_count: 0,
            classify_count: 0,
            classify_cents: 0,
            expenses_cents: 25000,
          },
        }),
      ),
    ).toBe(55000);
  });
});
