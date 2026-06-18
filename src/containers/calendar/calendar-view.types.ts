export type CalendarView = 'month' | 'week' | 'list';

export interface MonthlySummary {
  year?: number;
  month?: number;
  start_date?: string;
  end_date?: string;
  days: Array<{ date: string; total_sessions: number }>;
}
