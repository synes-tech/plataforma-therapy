import { describe, expect, it } from 'vitest';
import {
  buildTherapyMonthGrid,
  countTherapySessions,
  formatTherapyTimeRange,
  mapTherapyDaysByDate,
} from './therapy-calendar.utils';
import type { ScheduledTherapyDay } from './therapy-calendar.types';

describe('therapy-calendar.utils', () => {
  it('mapeia dias por data', () => {
    const days: ScheduledTherapyDay[] = [
      {
        date: '2026-06-10',
        sessions: [
          {
            id: '1',
            scheduled_at: '2026-06-10T14:00:00-03:00',
            time: '14:00',
            therapist_name: 'Ana Silva',
            status: 'scheduled',
            duration_minutes: 50,
            title: 'Sessão',
          },
        ],
      },
    ];
    const map = mapTherapyDaysByDate(days);
    expect(map.get('2026-06-10')?.sessions).toHaveLength(1);
  });

  it('conta sessões do mês', () => {
    expect(
      countTherapySessions([
        { date: '2026-06-01', sessions: [{ id: '1' } as never, { id: '2' } as never] },
        { date: '2026-06-02', sessions: [{ id: '3' } as never] },
      ]),
    ).toBe(3);
  });

  it('retorna zero sessões para mês vazio', () => {
    expect(countTherapySessions([])).toBe(0);
  });

  it('monta grade mensal com células vazias no início', () => {
    const grid = buildTherapyMonthGrid(2026, 6);
    expect(grid.some((c) => c.day === null)).toBe(true);
    expect(grid.filter((c) => c.day !== null)).toHaveLength(30);
  });

  it('formata intervalo de horário da sessão', () => {
    expect(formatTherapyTimeRange('14:00', 50)).toMatch(/14:00/);
  });
});
