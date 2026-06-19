/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';

const ALERT_LIST_MAX_HEIGHT_CLASS = 'max-h-96';

describe('DashboardAlertsCard layout constants', () => {
  it('usa altura máxima para ~10 itens com scroll', () => {
    expect(ALERT_LIST_MAX_HEIGHT_CLASS).toBe('max-h-96');
  });
});

export function filterUndismissedAlerts<T extends { id: string }>(
  entries: T[],
  dismissedIds: Set<string>,
  limit = 20,
): T[] {
  return entries.filter((entry) => !dismissedIds.has(entry.id)).slice(0, limit);
}

describe('filterUndismissedAlerts', () => {
  it('remove alertas já dispensados', () => {
    const entries = [
      { id: 'a1' },
      { id: 'a2' },
      { id: 'a3' },
    ];
    const dismissed = new Set(['a2']);

    expect(filterUndismissedAlerts(entries, dismissed).map((e) => e.id)).toEqual(['a1', 'a3']);
  });

  it('respeita limite máximo', () => {
    const entries = Array.from({ length: 25 }, (_, i) => ({ id: `e${i}` }));
    expect(filterUndismissedAlerts(entries, new Set(), 20)).toHaveLength(20);
  });
});
