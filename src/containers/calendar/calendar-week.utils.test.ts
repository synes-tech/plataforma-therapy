/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  durationToHeightPx,
  getWeekDays,
  getWeekSunday,
  layoutDayEvents,
  sessionsToLayoutedEvents,
} from './calendar-week.utils';
import type { LayoutedWeekEvent } from './calendar-week.types';

describe('calendar-week.utils', () => {
  it('calcula domingo e 7 dias da semana', () => {
    const sunday = getWeekSunday('2026-06-11');
    expect(sunday).toBe('2026-06-07');
    expect(getWeekDays(sunday)).toEqual([
      '2026-06-07',
      '2026-06-08',
      '2026-06-09',
      '2026-06-10',
      '2026-06-11',
      '2026-06-12',
      '2026-06-13',
    ]);
  });

  it('50 minutos é menor que 90 minutos em altura', () => {
    expect(durationToHeightPx(50)).toBeLessThan(durationToHeightPx(90));
    expect(durationToHeightPx(50)).toBeCloseTo((50 / 60) * 64, 5);
  });

  it('divide blocos sobrepostos em colunas', () => {
    const events: LayoutedWeekEvent[] = [
      {
        id: 'a',
        dayISO: '2026-06-09',
        patientName: 'Ana',
        status: 'scheduled',
        startMinutes: 9 * 60,
        endMinutes: 9 * 60 + 50,
        timeLabel: '09:00 - 09:50',
        column: 0,
        totalColumns: 1,
      },
      {
        id: 'b',
        dayISO: '2026-06-09',
        patientName: 'Lucas',
        status: 'scheduled',
        startMinutes: 9 * 60 + 10,
        endMinutes: 9 * 60 + 60,
        timeLabel: '09:10 - 10:00',
        column: 0,
        totalColumns: 1,
      },
    ];

    const laid = layoutDayEvents(events);
    const cols = new Set(laid.map((e) => e.column));
    expect(cols.size).toBe(2);
    expect(laid.every((e) => e.totalColumns >= 2)).toBe(true);
  });

  it('mapeia sessões da API para layout', () => {
    const laid = sessionsToLayoutedEvents([
      {
        id: '1',
        scheduled_at: '2026-06-09T12:00:00-03:00',
        duration_minutes: 50,
        status: 'scheduled',
        title: 'Sessão',
        patient: { id: 'p1', name: 'Maria' },
      },
    ]);
    expect(laid).toHaveLength(1);
    expect(laid[0]?.patientName).toBe('Maria');
    expect(laid[0]?.dayISO).toBe('2026-06-09');
  });
});
