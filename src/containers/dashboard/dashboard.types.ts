export interface BriefingPatient {
  id: string;
  name: string;
  birth_date?: string | null;
  foto_url?: string | null;
}

export type EvolutionStatus = 'pending' | 'draft' | 'approved';

export interface ScheduleItem {
  id: string;
  title: string | null;
  scheduled_at: string;
  duration_minutes: number | null;
  status: string;
  patient: BriefingPatient | null;
  evolution_status?: EvolutionStatus;
  session_note_id?: string | null;
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

export interface WeekDayPoint {
  date: string;
  label: string;
  count: number;
}

export interface PortfolioMix {
  with_family: number;
  without_family: number;
  stale_21d: number;
}

export interface PendingNoteItem {
  patient_id: string;
  patient_name: string;
  schedule_id: string | null;
  status: EvolutionStatus;
  scheduled_at: string | null;
}

export interface UnlinkedFamily {
  id: string;
  name: string;
}

export interface FinancePulse {
  received_cents: number;
  receivable_cents?: number;
  overdue_cents: number;
  overdue_count: number;
  classify_count: number;
  classify_cents: number;
  expenses_cents?: number;
  net_cents?: number;
}

export interface CompletedSessionItem {
  id: string;
  patient_id: string;
  patient_name: string;
  occurred_at: string;
  status: string;
  title?: string | null;
  source: 'note' | 'schedule';
}

export interface CompletedSessionsPulse {
  total: number;
  today: number;
  ai_processed?: number;
  items_total: CompletedSessionItem[];
  items_today: CompletedSessionItem[];
}

export interface BriefingSummary {
  sessions_today: number;
  sessions_this_week: number;
  active_patients_count: number;
  alerts_count: number;
  crisis_count: number;
  pending_notes_count: number;
  family_unlinked_count: number;
  occupancy_pct: number;
  sessions_completed_total?: number;
  sessions_completed_today?: number;
}

export interface DiaryMonthCheckin {
  id: string;
  entry_date: string;
  patient_id: string;
  patient_name: string;
  foto_url?: string | null;
  crisis_occurred?: boolean;
  created_at?: string | null;
}

export interface BriefingData {
  professional: { id: string; name: string };
  date: string;
  schedule: ScheduleItem[];
  alerts: AlertItem[];
  summary: BriefingSummary;
  week_days?: WeekDayPoint[];
  month_days?: WeekDayPoint[];
  year_months?: WeekDayPoint[];
  completed_sessions?: CompletedSessionsPulse;
  portfolio?: PortfolioMix;
  pending_notes?: PendingNoteItem[];
  family_unlinked?: UnlinkedFamily[];
  diary_month?: {
    month: string;
    days: string[];
    entries?: DiaryMonthCheckin[];
  };
  finance?: FinancePulse | null;
}

export type InboxKind = 'crisis' | 'note' | 'classify' | 'family' | 'overdue';

export interface InboxItem {
  id: string;
  kind: InboxKind;
  title: string;
  detail: string;
  to: string;
  tone: 'alert' | 'primary' | 'error' | 'slate';
}

export type SessionPhase = 'now' | 'upcoming' | 'done' | 'missed';

export interface ClinicTeamMember {
  id: string;
  name: string;
  specialty: string | null;
  sessions_today: number;
  next_at: string | null;
  next_patient: string | null;
}

export interface ClinicWeekRow {
  id: string;
  name: string;
  sessions: number;
}

export interface ClinicDashboardData {
  admin_name: string;
  clinic_name: string;
  professionals_count: number;
  max_professionals: number;
  patients_count: number;
  ai_reports_this_month: number;
  sessions_today?: number;
  occupancy_pct?: number;
  pending_family_links?: number;
  crisis_alerts_count?: number;
  team_today?: ClinicTeamMember[];
  week_by_professional?: ClinicWeekRow[];
  recent_professionals: Array<{
    id: string;
    name: string;
    specialty: string | null;
    status: string;
  }>;
}
