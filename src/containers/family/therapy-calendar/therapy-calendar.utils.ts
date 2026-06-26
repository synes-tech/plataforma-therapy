import type { ScheduledTherapyDay } from './therapy-calendar.types';

export function toTherapyDateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function buildTherapyMonthGrid(
  year: number,
  month: number,
): Array<{ day: number | null; dateKey?: string }> {
  const firstDow = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: Array<{ day: number | null; dateKey?: string }> = [];

  for (let i = 0; i < firstDow; i++) cells.push({ day: null });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, dateKey: toTherapyDateKey(year, month, d) });
  }

  return cells;
}

export function mapTherapyDaysByDate(days: ScheduledTherapyDay[]): Map<string, ScheduledTherapyDay> {
  const map = new Map<string, ScheduledTherapyDay>();
  for (const day of days) {
    map.set(day.date, day);
  }
  return map;
}

export function countTherapySessions(days: ScheduledTherapyDay[]): number {
  return days.reduce((acc, day) => acc + day.sessions.length, 0);
}

export function formatTherapyDateLong(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${date}T12:00:00`));
}

export function formatTherapyTimeRange(time: string, durationMinutes: number): string {
  const [hours, minutes] = time.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return time;

  const start = new Date(2000, 0, 1, hours, minutes);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const fmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return `${fmt.format(start)} – ${fmt.format(end)}`;
}
