import { describe, expect, it } from 'vitest';
import type { DiaryEntry } from '../patient-record.types';
import { buildDiaryPreview, diaryAuthorLabel } from './family-diary.format';

function entry(overrides: Partial<DiaryEntry> = {}): DiaryEntry {
  return {
    id: 'e1',
    entry_date: '2026-08-22',
    mood_score: 4,
    sleep_quality: 3,
    crisis_occurred: false,
    crisis_level: null,
    categories: [],
    notes: null,
    ...overrides,
  };
}

describe('preview do diário no prontuário', () => {
  it('não chama de família um auto-relato', () => {
    expect(buildDiaryPreview(entry({ author_access_level: 'SELF' }))).toBe(
      'Auto-relato sem observações escritas.',
    );
    expect(diaryAuthorLabel(entry({ author_access_level: 'SELF' }))).toBe('paciente');
  });

  it('prioriza gatilhos do payload sobre o texto genérico', () => {
    expect(
      buildDiaryPreview(
        entry({
          author_access_level: 'SELF',
          notes: 'ok',
          payload: { mood_10: 6, anxiety_10: 8, triggers: 'Reunião difícil' },
        }),
      ),
    ).toBe('Reunião difícil');
  });

  it('mostra as escalas quando o adulto só moveu os sliders', () => {
    expect(
      buildDiaryPreview(
        entry({
          author_access_level: 'SELF',
          payload: { mood_10: 3, anxiety_10: 9 },
        }),
      ),
    ).toBe('Humor 3/10 · Ansiedade 9/10');
  });

  it('mantém o texto do responsável quando não há payload', () => {
    expect(buildDiaryPreview(entry({ notes: 'Dormiu mal' }))).toBe('Dormiu mal');
    expect(diaryAuthorLabel(entry())).toBe('responsável');
  });
});
