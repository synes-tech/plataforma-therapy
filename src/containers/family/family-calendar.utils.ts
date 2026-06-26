import type { CrisisCalendarDay } from '@containers/patient/checkins/checkins-calendar.types';

export interface FamilyDiaryEntryRow {
  id: string;
  entry_date: string;
  mood_score: number;
  sleep_quality: number;
  crisis_occurred: boolean;
  crisis_level: number | null;
  categories: string[] | null;
  notes: string | null;
  transcricao: string | null;
  audio_note_url: string | null;
  family_member_id: string;
  created_at: string;
}

export function mapFamilyDiaryEntryToCheckinDay(entry: FamilyDiaryEntryRow): CrisisCalendarDay {
  return {
    id: entry.id,
    date: entry.entry_date,
    filled: true,
    mood_score: entry.mood_score,
    sleep_quality: entry.sleep_quality,
    crisis_occurred: entry.crisis_occurred,
    crisis_level: entry.crisis_level,
    categories: Array.isArray(entry.categories) ? entry.categories : [],
    notes: entry.notes,
    transcricao: entry.transcricao,
    audio_note_url: entry.audio_note_url,
    family_member_id: entry.family_member_id,
  };
}

export function formatFamilyCalendarModalTitle(date: string, hasCrisis: boolean): string {
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${date}T12:00:00`));

  return hasCrisis ? `Crise registrada — ${formatted}` : `Registro do dia — ${formatted}`;
}
