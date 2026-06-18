export interface BriefingPatient {
  id: string;
  name: string;
  birth_date?: string | null;
  foto_url?: string | null;
}

export interface ScheduleItem {
  id: string;
  title: string | null;
  scheduled_at: string;
  duration_minutes: number | null;
  status: string;
  patient: BriefingPatient | null;
}

export interface AlertItem {
  id: string;
  type: 'crisis' | 'positive';
  patient: { id: string; name: string } | null;
  entry_date: string;
  notes: string | null;
  crisis_level: number | null;
  hours_ago: number;
}

export interface BriefingSummary {
  sessions_today: number;
  sessions_this_week: number;
  active_patients_count: number;
  alerts_count: number;
  crisis_count: number;
}

export interface BriefingData {
  professional: { id: string; name: string };
  date: string;
  schedule: ScheduleItem[];
  alerts: AlertItem[];
  summary: BriefingSummary;
}
