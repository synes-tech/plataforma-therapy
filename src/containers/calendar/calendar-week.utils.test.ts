/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  buildHourMarkers,
  durationToHeightPx,
  getMinutesFromGridOffsetY,
  getTimeFromGridOffsetY,
  getTimeFromHourSlotClick,
  getWeekDays,
  getWeekSunday,
  isWeekFocusHour,
  layoutDayEvents,
  sessionsToLayoutedEvents,
  weekFocusScrollTopPx,
  weekFocusViewportHeightPx,
} from './calendar-week.utils';
import { WEEK_HOUR_END, WEEK_HOUR_HEIGHT_PX, WEEK_HOUR_START } from './calendar-week.types';
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
    expect(durationToHeightPx(50)).toBeCloseTo((50 / 60) * WEEK_HOUR_HEIGHT_PX, 5);
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

  it('abre a semana enquadrada das 08h às 19h', () => {
    expect(weekFocusScrollTopPx()).toBe(8 * WEEK_HOUR_HEIGHT_PX);
    expect(weekFocusViewportHeightPx()).toBe(11 * WEEK_HOUR_HEIGHT_PX);
    expect(isWeekFocusHour(8)).toBe(true);
    expect(isWeekFocusHour(18)).toBe(true);
    expect(isWeekFocusHour(7)).toBe(false);
    expect(isWeekFocusHour(19)).toBe(false);
  });

  it('marca as 24 horas do dia', () => {
    const hours = buildHourMarkers();
    expect(hours[0]).toBe(0);
    expect(hours.at(-1)).toBe(24);
    expect(hours).toHaveLength(WEEK_HOUR_END - WEEK_HOUR_START + 1);
  });

  it('inclui sessões de madrugada e noite', () => {
    const laid = sessionsToLayoutedEvents([
      {
        id: 'dawn',
        scheduled_at: '2026-06-09T00:30:00-03:00',
        duration_minutes: 50,
        status: 'scheduled',
        title: 'Sessão',
        patient: { id: 'p1', name: 'Madrugada' },
      },
      {
        id: 'night',
        scheduled_at: '2026-06-09T23:00:00-03:00',
        duration_minutes: 45,
        status: 'scheduled',
        title: 'Sessão',
        patient: { id: 'p2', name: 'Noite' },
      },
    ]);
    expect(laid.map((e) => e.patientName)).toEqual(['Madrugada', 'Noite']);
  });

  it('converte clique no grid em horário arredondado (15 min)', () => {
    expect(getTimeFromGridOffsetY(2 * WEEK_HOUR_HEIGHT_PX)).toBe('02:00');
    expect(getMinutesFromGridOffsetY(2 * WEEK_HOUR_HEIGHT_PX + WEEK_HOUR_HEIGHT_PX * 0.3)).toBe(2 * 60 + 15);
  });

  it('clique no quadrado da hora sempre abre no horário cheio', () => {
    expect(getTimeFromHourSlotClick(8)).toBe('08:00');
    expect(getTimeFromHourSlotClick(9)).toBe('09:00');
    expect(getTimeFromHourSlotClick(14)).toBe('14:00');
    expect(getTimeFromHourSlotClick(23)).toBe('23:00');
  });
});
