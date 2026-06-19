import { describe, expect, it } from 'vitest';
import {
  calculatePatientAge,
  formatDiaryContextBlock,
  formatDiaryEntryLine,
} from './patient-copilot-context.utils';

describe('formatDiaryEntryLine', () => {
  it('inclui humor, sono, crise e relato', () => {
    const line = formatDiaryEntryLine({
      entry_date: '2026-06-15',
      mood_score: 3,
      sleep_quality: 2,
      crisis_occurred: true,
      crisis_level: 4,
      categories: ['escola', 'sono'],
      notes: 'Agitação após a escola',
    });

    expect(line).toContain('2026-06-15');
    expect(line).toContain('Humor: 3/5');
    expect(line).toContain('CRISE nível 4');
    expect(line).toContain('Agitação após a escola');
  });
});

describe('formatDiaryContextBlock', () => {
  it('retorna mensagem vazia quando não há entradas', () => {
    expect(formatDiaryContextBlock([])).toBe('Nenhuma entrada recente no diário familiar.');
  });

  it('concatena múltiplas entradas para injeção no system prompt', () => {
    const block = formatDiaryContextBlock([
      {
        entry_date: '2026-06-14',
        mood_score: 4,
        sleep_quality: 3,
        crisis_occurred: false,
        crisis_level: null,
        categories: [],
        notes: 'Dia tranquilo',
      },
      {
        entry_date: '2026-06-13',
        mood_score: 2,
        sleep_quality: 2,
        crisis_occurred: true,
        crisis_level: 3,
        categories: ['social'],
        notes: 'Crise no parque',
      },
    ]);

    expect(block).toContain('Dia tranquilo');
    expect(block).toContain('Crise no parque');
    expect(block.split('\n')).toHaveLength(2);
  });
});

describe('calculatePatientAge', () => {
  it('calcula idade corretamente', () => {
    expect(calculatePatientAge('2018-03-10', new Date('2026-06-09'))).toBe(8);
  });
});
