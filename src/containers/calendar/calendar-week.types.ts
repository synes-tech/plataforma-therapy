export interface WeekSession {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  title: string | null;
  patient: { id: string; name: string } | null;
}

export interface RangeSessionsResponse {
  date?: string;
  start_date?: string;
  end_date?: string;
  sessions: WeekSession[];
}

export interface LayoutedWeekEvent {
  id: string;
  dayISO: string;
  patientName: string;
  status: string;
  startMinutes: number;
  endMinutes: number;
  timeLabel: string;
  column: number;
  totalColumns: number;
}

export const WEEK_HOUR_START = 0;
export const WEEK_HOUR_END = 24;
export const WEEK_HOUR_HEIGHT_PX = 48;
/** Janela em destaque ao abrir a semana (rolagem mostra o restante). */
export const WEEK_FOCUS_HOUR_START = 8;
export const WEEK_FOCUS_HOUR_END = 19;

export interface WeekSlotClickPayload {
  dayISO: string;
  time: string;
}
