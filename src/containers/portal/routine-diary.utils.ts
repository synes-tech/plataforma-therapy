export interface RoutineDiaryEntry {
  id: string;
  mood_score: number;
  sleep_quality: number;
  crisis_occurred: boolean;
  crisis_level: number | null;
  notes: string | null;
  created_at: string;
}

/** Máximo de dias retroativos (espelha backend). */
export const DIARY_MAX_RETROACTIVE_DAYS = 14;

export function todayEntryDateKey(date = new Date()): string {
  return date.toISOString().split('T')[0]!;
}

export function isValidEntryDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00`);
  return !Number.isNaN(parsed.getTime());
}

export function minRetroactiveEntryDateKey(date = new Date()): string {
  const d = new Date(date);
  d.setDate(d.getDate() - DIARY_MAX_RETROACTIVE_DAYS);
  return todayEntryDateKey(d);
}

export function isTodayEntryDate(entryDate: string): boolean {
  return entryDate === todayEntryDateKey();
}

/** Data permitida para novo check-in (hoje ou retroativo dentro do limite). */
export function canRegisterEntryDate(entryDate: string, date = new Date()): boolean {
  if (!isValidEntryDateKey(entryDate)) return false;
  const today = todayEntryDateKey(date);
  if (entryDate > today) return false;
  return entryDate >= minRetroactiveEntryDateKey(date);
}

export function formatEntryDateLong(entryDate: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${entryDate}T12:00:00`));
}

export function formatEntryDateShort(entryDate: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(new Date(`${entryDate}T12:00:00`));
}

export function formatRoutineEntryTime(isoTimestamp: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoTimestamp));
}

export function moodEmoji(moodScore: number): string {
  const map: Record<number, string> = {
    1: '😢',
    2: '😟',
    3: '😐',
    4: '🙂',
    5: '😄',
  };
  return map[moodScore] ?? '😐';
}

export function buildRoutineEntrySummary(entry: RoutineDiaryEntry): string {
  const parts = [`Humor ${entry.mood_score}/5`, `Sono ${entry.sleep_quality}/5`];
  if (entry.crisis_occurred) {
    parts.push(`Crise ${entry.crisis_level ?? '?'}/5`);
  }
  return parts.join(' · ');
}

export function pluralizeRegistros(count: number): string {
  return count === 1 ? '1 registro' : `${count} registros`;
}
