export interface RoutineDiaryEntry {
  id: string;
  mood_score: number;
  sleep_quality: number;
  crisis_occurred: boolean;
  crisis_level: number | null;
  notes: string | null;
  created_at: string;
}

export function todayEntryDateKey(date = new Date()): string {
  return date.toISOString().split('T')[0]!;
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
