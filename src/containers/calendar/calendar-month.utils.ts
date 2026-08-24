const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export { WEEKDAYS };

export function brTodayISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function buildMonthGrid(
  year: number,
  month0: number,
): Array<{ iso: string; day: number; inMonth: boolean }> {
  const firstOfMonth = new Date(year, month0, 1);
  const startWeekday = firstOfMonth.getDay();
  const cells: Array<{ iso: string; day: number; inMonth: boolean }> = [];
  const start = new Date(year, month0, 1 - startWeekday);

  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    cells.push({ iso, day: d.getDate(), inMonth: d.getMonth() === month0 });
  }

  return cells;
}

export function monthDateRange(year: number, month0: number): { start: string; end: string } {
  const lastDay = new Date(year, month0 + 1, 0).getDate();
  return {
    start: `${year}-${pad(month0 + 1)}-01`,
    end: `${year}-${pad(month0 + 1)}-${pad(lastDay)}`,
  };
}

export interface MonthSessionChip {
  id: string;
  name: string;
  status: string;
  time: string;
}

export function groupMonthSessionChips(
  sessions: Array<{
    id: string;
    scheduled_at: string;
    status: string;
    title: string | null;
    patient: { id: string; name: string } | null;
  }>,
  toDayISO: (iso: string) => string,
  toTime: (iso: string) => string,
): Map<string, MonthSessionChip[]> {
  const map = new Map<string, MonthSessionChip[]>();
  for (const session of sessions) {
    const day = toDayISO(session.scheduled_at);
    const list = map.get(day) ?? [];
    list.push({
      id: session.id,
      name: session.patient?.name ?? session.title ?? 'Sessão',
      status: session.status,
      time: toTime(session.scheduled_at),
    });
    map.set(day, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.time.localeCompare(b.time));
  }
  return map;
}

export function formatDayTitle(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y!, (m ?? 1) - 1, d);
  const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(date);
  const long = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long' }).format(date);
  const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${cap}, ${long}`;
}
