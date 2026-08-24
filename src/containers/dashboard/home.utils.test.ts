/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import type { BriefingData, ScheduleItem } from './dashboard.types';
import {
  briefingSubtitle,
  buildInbox,
  buildMonthCells,
  checkinsForDay,
  formatCountdown,
  inboxCount,
  monthTitle,
  occupancyHint,
  pickNextSession,
  portfolioSlices,
  sessionPhase,
  weekBarMax,
  weekBarTicks,
  withSummaryDefaults,
} from './home.utils';

function session(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    id: 's1',
    title: 'Sessão',
    scheduled_at: '2026-08-14T14:00:00-03:00',
    duration_minutes: 50,
    status: 'scheduled',
    patient: { id: 'p1', name: 'Ana' },
    ...overrides,
  };
}

const NOW = new Date('2026-08-14T14:20:00-03:00').getTime();

function briefing(overrides: Partial<BriefingData> = {}): BriefingData {
  return {
    professional: { id: 'pro', name: 'João' },
    date: '2026-08-14',
    schedule: [],
    alerts: [],
    summary: withSummaryDefaults(),
    week_days: [],
    portfolio: { with_family: 4, without_family: 2, stale_21d: 1 },
    pending_notes: [],
    family_unlinked: [],
    finance: null,
    ...overrides,
  };
}

describe('sessionPhase / pickNextSession', () => {
  it('marca a sessão corrente como agora', () => {
    expect(sessionPhase(session(), NOW)).toBe('now');
  });

  it('escolhe a próxima que ainda não acabou', () => {
    const next = pickNextSession(
      [
        session({ id: 'past', scheduled_at: '2026-08-14T09:00:00-03:00' }),
        session({ id: 'now', scheduled_at: '2026-08-14T14:00:00-03:00' }),
        session({ id: 'later', scheduled_at: '2026-08-14T16:00:00-03:00' }),
      ],
      NOW,
    );
    expect(next?.id).toBe('now');
  });

  it('ignora canceladas', () => {
    expect(
      pickNextSession([session({ status: 'cancelled', scheduled_at: '2026-08-14T16:00:00-03:00' })], NOW),
    ).toBeNull();
  });
});

describe('formatCountdown', () => {
  it('usa agora quando o horário já passou', () => {
    expect(formatCountdown('2026-08-14T14:00:00-03:00', NOW)).toBe('agora');
  });

  it('formata minutos', () => {
    expect(formatCountdown('2026-08-14T14:40:00-03:00', NOW)).toBe('em 20 min');
  });
});

describe('briefingSubtitle', () => {
  it('mensagem para zero sessões hoje', () => {
    expect(briefingSubtitle(withSummaryDefaults())).toContain('Nenhum atendimento');
  });

  it('menciona evoluções em aberto quando a agenda está livre', () => {
    expect(briefingSubtitle(withSummaryDefaults({ pending_notes_count: 2 }))).toContain('2 evoluções');
  });

  it('mensagem plural', () => {
    expect(briefingSubtitle(withSummaryDefaults({ sessions_today: 3 }))).toContain('3 atendimentos');
  });
});

describe('buildInbox', () => {
  it('prioriza crise e esconde financeiro sem permissão', () => {
    const items = buildInbox(
      briefing({
        alerts: [
          {
            id: 'a1',
            type: 'crisis',
            patient: { id: 'p1', name: 'Ana' },
            entry_date: '2026-08-14',
            notes: null,
            crisis_level: 4,
            hours_ago: 2,
          },
        ],
        pending_notes: [
          {
            patient_id: 'p2',
            patient_name: 'Bruno',
            schedule_id: 'sch-1',
            status: 'pending',
            scheduled_at: '2026-08-14T09:00:00-03:00',
          },
        ],
        family_unlinked: [{ id: 'p3', name: 'Caio' }],
        finance: {
          received_cents: 1000,
          overdue_cents: 500,
          overdue_count: 1,
          classify_count: 3,
          classify_cents: 900,
        },
        summary: withSummaryDefaults({ pending_notes_count: 1, family_unlinked_count: 1, crisis_count: 1 }),
      }),
      false,
    );

    expect(items.map((item) => item.kind)).toEqual(['crisis', 'note', 'family']);
    expect(items[0]?.to).toContain('/checkins');
  });

  it('inclui classificar e atrasados para quem tem caixa', () => {
    const items = buildInbox(
      briefing({
        finance: {
          received_cents: 840000,
          overdue_cents: 120000,
          overdue_count: 2,
          classify_count: 4,
          classify_cents: 80000,
        },
      }),
      true,
    );
    expect(items.map((item) => item.kind)).toEqual(['classify', 'overdue']);
  });
});

describe('inboxCount / occupancy / portfolio', () => {
  it('soma pendências visíveis', () => {
    expect(
      inboxCount(
        briefing({
          summary: withSummaryDefaults({ pending_notes_count: 1, family_unlinked_count: 1, crisis_count: 1 }),
          alerts: [
            {
              id: 'c',
              type: 'crisis',
              patient: { id: 'p', name: 'Ana' },
              entry_date: '2026-08-14',
              notes: null,
              crisis_level: 3,
              hours_ago: 1,
            },
          ],
          finance: {
            received_cents: 0,
            overdue_cents: 0,
            overdue_count: 1,
            classify_count: 2,
            classify_cents: 0,
          },
        }),
        true,
      ),
    ).toBe(6);
  });

  it('descreve ocupação sem inventar meta', () => {
    expect(occupancyHint(0, 0)).toContain('Nenhuma sessão');
    expect(occupancyHint(85, 18)).toContain('cheia');
  });

  it('omite fatias zeradas da carteira', () => {
    expect(portfolioSlices({ with_family: 3, without_family: 0, stale_21d: 1 }).map((s) => s.id)).toEqual([
      'family',
      'stale',
    ]);
  });

  it('fixa o eixo em 10 mesmo com uma sessão', () => {
    expect(weekBarMax([{ date: '2026-08-14', label: 'sex', count: 1 }])).toBe(10);
  });

  it('sobe de 2 em 2 quando passa de 10', () => {
    expect(weekBarMax([{ date: '2026-08-14', label: 'sex', count: 11 }])).toBe(12);
  });

  it('marca o eixo de 0 a 10 de 2 em 2', () => {
    expect(weekBarTicks(10)).toEqual([0, 2, 4, 6, 8, 10]);
  });
});

describe('checkinsForDay', () => {
  it('filtra o dia e ordena do mais recente', () => {
    const items = checkinsForDay(
      [
        {
          id: 'a',
          entry_date: '2026-08-14',
          patient_id: 'p1',
          patient_name: 'Ana',
          created_at: '2026-08-14T08:00:00-03:00',
        },
        {
          id: 'b',
          entry_date: '2026-08-13',
          patient_id: 'p2',
          patient_name: 'Bia',
          created_at: '2026-08-13T10:00:00-03:00',
        },
        {
          id: 'c',
          entry_date: '2026-08-14',
          patient_id: 'p3',
          patient_name: 'Caio',
          created_at: '2026-08-14T19:20:00-03:00',
        },
      ],
      '2026-08-14',
    );
    expect(items.map((item) => item.id)).toEqual(['c', 'a']);
  });

  it('retorna vazio quando o dia não tem registro', () => {
    expect(checkinsForDay([], '2026-08-14')).toEqual([]);
  });
});

describe('buildMonthCells', () => {
  it('gera agosto com 31 dias e começa no sábado de 2026', () => {
    const cells = buildMonthCells('2026-08');
    const days = cells.filter((cell) => cell.day !== null);
    expect(days).toHaveLength(31);
    expect(days[0]?.dateKey).toBe('2026-08-01');
    expect(days[30]?.dateKey).toBe('2026-08-31');
    expect(cells[0]?.day).toBeNull();
    expect(monthTitle('2026-08')).toBe('Agosto de 2026');
  });
});
