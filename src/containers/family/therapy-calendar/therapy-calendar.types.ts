export interface ScheduledTherapySession {
  id: string;
  schedule_id?: string | null;
  session_note_id?: string | null;
  scheduled_at: string;
  time: string;
  therapist_name: string;
  status: string;
  duration_minutes: number;
  title: string;
  has_shared_report?: boolean;
}

export interface ScheduledTherapyDay {
  date: string;
  sessions: ScheduledTherapySession[];
}

export interface ScheduledTherapiesResponse {
  patient_id: string;
  year: number;
  month: number;
  days: ScheduledTherapyDay[];
}

export const THERAPY_WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const THERAPY_MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const THERAPY_STATUS_LABELS: Record<string, string> = {
  scheduled: 'Agendada',
  in_progress: 'Em andamento',
  completed: 'Realizada',
  not_completed: 'Não realizada',
};
