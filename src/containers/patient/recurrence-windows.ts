export const WEEKDAYS = [
  { iso: 1, short: 'Seg', long: 'Segunda' },
  { iso: 2, short: 'Ter', long: 'Terça' },
  { iso: 3, short: 'Qua', long: 'Quarta' },
  { iso: 4, short: 'Qui', long: 'Quinta' },
  { iso: 5, short: 'Sex', long: 'Sexta' },
  { iso: 6, short: 'Sáb', long: 'Sábado' },
  { iso: 7, short: 'Dom', long: 'Domingo' },
] as const;

export interface RecurrenceWindowDraft {
  weekday: number;
  start_time: string;
  duration_minutes: number;
}

export const EMPTY_WINDOW: RecurrenceWindowDraft = {
  weekday: 5,
  start_time: '10:00',
  duration_minutes: 50,
};

export function normalizeWindowTime(raw: string): string {
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return '10:00';
  const hour = Math.min(23, Math.max(0, Number(match[1])));
  const minute = Math.min(59, Math.max(0, Number(match[2])));
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function weekdayLabel(iso: number, variant: 'short' | 'long' = 'long'): string {
  const found = WEEKDAYS.find((item) => item.iso === iso);
  return found ? found[variant] : `Dia ${iso}`;
}

export function previewOccurrences(
  windows: RecurrenceWindowDraft[],
  daysAhead = 45,
  limit = 8,
): Array<{ date: string; label: string; weekday: number; time: string }> {
  const valid = windows.filter((item) => item.weekday >= 1 && item.weekday <= 7 && item.start_time);
  if (valid.length === 0) return [];

  const out: Array<{ date: string; label: string; weekday: number; time: string }> = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  for (let offset = 0; offset < daysAhead && out.length < limit; offset += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + offset);
    const isoDow = day.getDay() === 0 ? 7 : day.getDay();
    for (const window of valid) {
      if (window.weekday !== isoDow) continue;
      const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      const label = new Intl.DateTimeFormat('pt-BR', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
      }).format(day);
      out.push({
        date,
        label: `${label} · ${normalizeWindowTime(window.start_time)}`,
        weekday: window.weekday,
        time: normalizeWindowTime(window.start_time),
      });
    }
  }
  return out;
}
