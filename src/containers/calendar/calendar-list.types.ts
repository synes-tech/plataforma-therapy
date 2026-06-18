import type { WeekSession } from './calendar-week.types';

export type ListSession = WeekSession;

export interface ListSessionsResponse {
  view: 'list';
  start_date: string;
  end_date: string;
  sessions: ListSession[];
}

export interface DaySessionGroup {
  dateISO: string;
  sessions: ListSession[];
}

export interface ListStatusStyle {
  label: string;
  borderClass: string;
  dotClass: string;
}
