/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  addDaysISO,
  formatListDayHeader,
  groupSessionsByDay,
  scheduledAtToDayISO,
} from './calendar-list.utils';
import type { ListSession } from './calendar-list.types';

function session(id: string, scheduledAt: string): ListSession {
  return {
    id,
    scheduled_at: scheduledAt,
    duration_minutes: 50,
    status: 'scheduled',
    title: 'Atendimento',
    patient: { id: 'p1', name: 'Ana' },
  };
}

describe('calendar-list.utils', () => {
  it('agrupa sessões por dia em ordem cronológica', () => {
    const sessions = [
      session('1', '2026-06-10T14:00:00-03:00'),
      session('2', '2026-06-09T09:00:00-03:00'),
      session('3', '2026-06-09T11:00:00-03:00'),
      session('4', '2026-06-11T08:00:00-03:00'),
    ];

    const groups = groupSessionsByDay(sessions);

    expect(groups.map((g) => g.dateISO)).toEqual(['2026-06-09', '2026-06-10', '2026-06-11']);
    expect(groups[0]!.sessions.map((s) => s.id)).toEqual(['2', '3']);
    expect(groups[1]!.sessions.map((s) => s.id)).toEqual(['1']);
  });

  it('formata cabeçalho Hoje e Amanhã', () => {
    expect(formatListDayHeader('2026-06-09', '2026-06-09')).toMatch(/^Hoje,/);
    expect(formatListDayHeader('2026-06-10', '2026-06-09')).toMatch(/^Amanhã,/);
    expect(formatListDayHeader('2026-06-12', '2026-06-09')).toMatch(/^Sexta,/);
  });

  it('converte scheduled_at para dia BR', () => {
    expect(scheduledAtToDayISO('2026-06-09T23:30:00-03:00')).toBe('2026-06-09');
    expect(addDaysISO('2026-06-09', 30)).toBe('2026-07-09');
  });
});
