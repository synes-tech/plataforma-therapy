/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { groupMonthSessionChips, monthDateRange } from './calendar-month.utils';

describe('calendar-month.utils', () => {
  it('calcula o intervalo do mês', () => {
    expect(monthDateRange(2026, 7)).toEqual({ start: '2026-08-01', end: '2026-08-31' });
  });

  it('agrupa sessões por dia e ordena pelo horário', () => {
    const map = groupMonthSessionChips(
      [
        {
          id: 'b',
          scheduled_at: '2026-08-14T14:00:00-03:00',
          status: 'scheduled',
          title: null,
          patient: { id: 'p2', name: 'Bia' },
        },
        {
          id: 'a',
          scheduled_at: '2026-08-14T09:00:00-03:00',
          status: 'scheduled',
          title: null,
          patient: { id: 'p1', name: 'Ana' },
        },
      ],
      (iso) => iso.slice(0, 10),
      (iso) => iso.slice(11, 16),
    );
    expect(map.get('2026-08-14')?.map((item) => item.name)).toEqual(['Ana', 'Bia']);
  });
});
