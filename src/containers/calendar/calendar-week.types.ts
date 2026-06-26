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

export const WEEK_HOUR_START = 7;
export const WEEK_HOUR_END = 22;
export const WEEK_HOUR_HEIGHT_PX = 64;

export interface WeekSlotClickPayload {
  dayISO: string;
  time: string;
}
