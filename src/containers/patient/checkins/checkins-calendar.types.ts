export interface CheckinTextDetail {
  kind: string;
  label: string;
  text: string;
}

export interface CrisisCalendarDay {
  id?: string;
  date: string;
  filled: boolean;
  mood_score: number;
  sleep_quality: number;
  crisis_occurred: boolean;
  crisis_level: number | null;
  categories: string[];
  notes: string | null;
  transcricao?: string | null;
  audio_note_url?: string | null;
  text_details?: CheckinTextDetail[];
  family_member_id: string;
}

export interface CrisisCalendarSummary {
  total_entries: number;
  crisis_count: number;
  fill_rate: number;
}

export interface CrisisCalendarResponse {
  patient_id: string;
  year: number;
  month: number;
  days: CrisisCalendarDay[];
  summary: CrisisCalendarSummary;
}

export const CHECKIN_WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const CHECKIN_MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const MOOD_LABELS: Record<number, { emoji: string; label: string }> = {
  1: { emoji: '😢', label: 'Difícil' },
  2: { emoji: '😟', label: 'Abaixo' },
  3: { emoji: '😐', label: 'Neutro' },
  4: { emoji: '🙂', label: 'Bom' },
  5: { emoji: '😄', label: 'Ótimo' },
};

export const SLEEP_LABELS: Record<number, string> = {
  1: 'Péssimo',
  2: 'Ruim',
  3: 'Regular',
  4: 'Bom',
  5: 'Ótimo',
};

export const CATEGORY_LABELS: Record<string, string> = {
  sono: 'Sono',
  escola: 'Escola',
  alimentacao: 'Alimentação',
  social: 'Social',
  hiperatividade: 'Agitação',
  sensorial: 'Sensorial',
};
