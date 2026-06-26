import { describe, expect, it } from 'vitest';
import {
  buildCheckinPreview,
  getCheckinTextDetails,
  sortFilledCheckinDays,
} from './checkins-calendar.utils';
import type { CrisisCalendarDay } from './checkins-calendar.types';

const LOREM =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(12);

function baseDay(overrides: Partial<CrisisCalendarDay> = {}): CrisisCalendarDay {
  return {
    date: '2026-06-15',
    filled: true,
    mood_score: 4,
    sleep_quality: 3,
    crisis_occurred: false,
    crisis_level: null,
    categories: ['sono'],
    notes: null,
    family_member_id: 'fm-1',
    ...overrides,
  };
}

describe('checkins-calendar.utils', () => {
  it('monta text_details a partir de notes e transcricao legadas', () => {
    const details = getCheckinTextDetails(
      baseDay({ notes: 'Dormiu mal', transcricao: 'Relato gravado' }),
    );
    expect(details).toHaveLength(2);
    expect(details[0]?.kind).toBe('notes');
    expect(details[1]?.kind).toBe('transcricao');
  });

  it('prioriza text_details do payload quando presente', () => {
    const details = getCheckinTextDetails(
      baseDay({
        text_details: [{ kind: 'notes', label: 'Observações', text: 'Payload completo' }],
        notes: 'legado',
      }),
    );
    expect(details).toHaveLength(1);
    expect(details[0]?.text).toBe('Payload completo');
  });

  it('check-in legado sem texto retorna preview neutro', () => {
    expect(buildCheckinPreview(baseDay())).toContain('Sem observações escritas');
    expect(getCheckinTextDetails(baseDay())).toHaveLength(0);
  });

  it('trunca preview longo sem estourar layout', () => {
    const preview = buildCheckinPreview(baseDay({ notes: LOREM }), 88);
    expect(preview.length).toBeLessThanOrEqual(89);
    expect(preview.endsWith('…')).toBe(true);
  });

  it('ordena dias preenchidos do mais recente ao mais antigo', () => {
    const sorted = sortFilledCheckinDays([
      baseDay({ date: '2026-06-01' }),
      baseDay({ date: '2026-06-20', filled: true }),
      baseDay({ date: '2026-06-10', filled: true }),
      baseDay({ date: '2026-06-05', filled: false }),
    ]);
    expect(sorted.map((d) => d.date)).toEqual(['2026-06-20', '2026-06-10', '2026-06-01']);
  });
});
