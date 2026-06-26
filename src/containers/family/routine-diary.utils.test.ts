import { describe, expect, it } from 'vitest';
import {
  buildRoutineEntrySummary,
  formatRoutineEntryTime,
  moodEmoji,
  pluralizeRegistros,
  todayEntryDateKey,
} from './routine-diary.utils';

describe('routine-diary.utils', () => {
  it('todayEntryDateKey retorna YYYY-MM-DD', () => {
    expect(todayEntryDateKey(new Date('2026-06-09T15:30:00.000Z'))).toBe('2026-06-09');
  });

  it('formatRoutineEntryTime formata hora local', () => {
    const formatted = formatRoutineEntryTime('2026-06-09T14:05:00.000Z');
    expect(formatted).toMatch(/\d{2}:\d{2}/);
  });

  it('moodEmoji mapeia scores conhecidos', () => {
    expect(moodEmoji(5)).toBe('😄');
    expect(moodEmoji(99)).toBe('😐');
  });

  it('buildRoutineEntrySummary inclui crise quando houver', () => {
    expect(
      buildRoutineEntrySummary({
        id: '1',
        mood_score: 2,
        sleep_quality: 3,
        crisis_occurred: true,
        crisis_level: 4,
        notes: null,
        created_at: '2026-06-09T10:00:00.000Z',
      }),
    ).toContain('Crise 4/5');
  });

  it('pluralizeRegistros trata singular e plural', () => {
    expect(pluralizeRegistros(1)).toBe('1 registro');
    expect(pluralizeRegistros(3)).toBe('3 registros');
  });
});
