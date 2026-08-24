import type { TheryTourAudience, TheryTourRecord } from './thery-tour.types';

export function tourStorageKey(userId: string, audience: TheryTourAudience): string {
  return `unithery:thery-tour:${userId}:${audience}`;
}

function isRecord(value: unknown): value is TheryTourRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as TheryTourRecord;
  return (
    (record.status === 'skipped' || record.status === 'in_progress' || record.status === 'completed') &&
    typeof record.stepIndex === 'number' &&
    Number.isFinite(record.stepIndex) &&
    typeof record.updatedAt === 'string'
  );
}

export function readTourRecord(userId: string, audience: TheryTourAudience): TheryTourRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(tourStorageKey(userId, audience));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeTourRecord(
  userId: string,
  audience: TheryTourAudience,
  record: TheryTourRecord,
): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(tourStorageKey(userId, audience), JSON.stringify(record));
}
