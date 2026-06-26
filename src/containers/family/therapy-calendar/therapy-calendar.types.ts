export interface ScheduledTherapySession {
  id: string;
  scheduled_at: string;
  time: string;
  therapist_name: string;
  status: 'scheduled' | 'in_progress' | string;
  duration_minutes: number;
  title: string;
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
  in_progress: 'Confirmada',
};
