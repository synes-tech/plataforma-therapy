import type { DaySessionGroup, ListSession, ListStatusStyle } from './calendar-list.types';

const BR_TZ = 'America/Sao_Paulo';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d);
}

export function addDaysISO(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function scheduledAtToDayISO(scheduledAt: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(scheduledAt));
}

/** Agrupa sessões por dia (YYYY-MM-DD), em ordem cronológica ascendente. */
export function groupSessionsByDay(sessions: ListSession[]): DaySessionGroup[] {
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
  );

  const order: string[] = [];
  const map = new Map<string, ListSession[]>();

  for (const session of sorted) {
    const dateISO = scheduledAtToDayISO(session.scheduled_at);
    if (!map.has(dateISO)) {
      map.set(dateISO, []);
      order.push(dateISO);
    }
    map.get(dateISO)!.push(session);
  }

  return order.map((dateISO) => ({
    dateISO,
    sessions: map.get(dateISO)!,
  }));
}

export function formatListDayHeader(dateISO: string, todayISO: string): string {
  const tomorrowISO = addDaysISO(todayISO, 1);
  const date = parseISODate(dateISO);
  const longDate = new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
  }).format(date);

  if (dateISO === todayISO) return `Hoje, ${longDate}`;
  if (dateISO === tomorrowISO) return `Amanhã, ${longDate}`;

  const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(date);
  const shortWeekday = weekday.replace(/-feira$/, '');
  const cap = shortWeekday.charAt(0).toUpperCase() + shortWeekday.slice(1);
  return `${cap}, ${longDate}`;
}

export function formatListTime(scheduledAt: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: BR_TZ,
  }).format(new Date(scheduledAt));
}

export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return '—';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export function getSessionTypeLabel(title: string | null): string {
  if (!title?.trim()) return 'Atendimento';
  const t = title.toLowerCase();
  if (t.includes('online')) return 'Online';
  if (t.includes('presencial')) return 'Presencial';
  return title;
}

export const LIST_STATUS_STYLES: Record<string, ListStatusStyle> = {
  scheduled: {
    label: 'Aguardando',
    borderClass: 'border-l-blue-500',
    dotClass: 'bg-blue-500',
  },
  completed: {
    label: 'Concluída',
    borderClass: 'border-l-emerald-500',
    dotClass: 'bg-emerald-500',
  },
  canceled: {
    label: 'Cancelada',
    borderClass: 'border-l-slate-400',
    dotClass: 'bg-slate-400',
  },
  cancelled: {
    label: 'Cancelada',
    borderClass: 'border-l-slate-400',
    dotClass: 'bg-slate-400',
  },
  no_show: {
    label: 'Faltou',
    borderClass: 'border-l-amber-500',
    dotClass: 'bg-amber-500',
  },
};

export function getListStatusStyle(status: string): ListStatusStyle {
  return (
    LIST_STATUS_STYLES[status] ?? {
      label: status,
      borderClass: 'border-l-slate-300',
      dotClass: 'bg-slate-300',
    }
  );
}
