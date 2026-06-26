import type { LayoutedWeekEvent, WeekSession } from './calendar-week.types';
import { WEEK_HOUR_END, WEEK_HOUR_HEIGHT_PX, WEEK_HOUR_START } from './calendar-week.types';

const BR_TZ = 'America/Sao_Paulo';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function isoFromDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Domingo da semana que contém anchorISO (YYYY-MM-DD). */
export function getWeekSunday(anchorISO: string): string {
  const [y, m, d] = anchorISO.split('-').map(Number);
  const date = new Date(y!, (m ?? 1) - 1, d);
  const sunday = new Date(date);
  sunday.setDate(date.getDate() - date.getDay());
  return isoFromDate(sunday);
}

export function getWeekDays(sundayISO: string): string[] {
  const [y, m, d] = sundayISO.split('-').map(Number);
  const start = new Date(y!, (m ?? 1) - 1, d);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return isoFromDate(day);
  });
}

export function shiftWeek(sundayISO: string, deltaWeeks: number): string {
  const [y, m, d] = sundayISO.split('-').map(Number);
  const date = new Date(y!, (m ?? 1) - 1, d);
  date.setDate(date.getDate() + deltaWeeks * 7);
  return isoFromDate(date);
}

export function formatWeekRangeLabel(sundayISO: string): string {
  const days = getWeekDays(sundayISO);
  const start = days[0]!;
  const end = days[6]!;
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const startDate = new Date(sy!, (sm ?? 1) - 1, sd);
  const endDate = new Date(ey!, (em ?? 1) - 1, ed);
  const fmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' });
  const yearFmt = new Intl.DateTimeFormat('pt-BR', { year: 'numeric' });
  return `${fmt.format(startDate)} – ${fmt.format(endDate)} ${yearFmt.format(endDate)}`;
}

export function getBrDateISO(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

export function getBrMinutesSinceMidnight(iso: string): number {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BR_TZ,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

export function formatTimeBr(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: BR_TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatTimeRangeBr(startISO: string, durationMinutes: number): string {
  const start = formatTimeBr(startISO);
  const endDate = new Date(new Date(startISO).getTime() + durationMinutes * 60_000);
  const end = formatTimeBr(endDate.toISOString());
  return `${start} - ${end}`;
}

export function minutesToTopPx(minutes: number): number {
  const gridStart = WEEK_HOUR_START * 60;
  return ((minutes - gridStart) / 60) * WEEK_HOUR_HEIGHT_PX;
}

export function durationToHeightPx(durationMinutes: number): number {
  return (durationMinutes / 60) * WEEK_HOUR_HEIGHT_PX;
}

export function weekGridHeightPx(): number {
  return (WEEK_HOUR_END - WEEK_HOUR_START) * WEEK_HOUR_HEIGHT_PX;
}

export function buildHourMarkers(): number[] {
  const hours: number[] = [];
  for (let h = WEEK_HOUR_START; h <= WEEK_HOUR_END; h++) hours.push(h);
  return hours;
}

function overlaps(a: LayoutedWeekEvent, b: LayoutedWeekEvent): boolean {
  return a.endMinutes > b.startMinutes && a.startMinutes < b.endMinutes;
}

export function layoutDayEvents(events: LayoutedWeekEvent[]): LayoutedWeekEvent[] {
  if (events.length === 0) return [];
  const sorted = [...events].sort((a, b) => a.startMinutes - b.startMinutes);
  const layouts = sorted.map((e) => ({ ...e, column: 0, totalColumns: 1 }));

  for (let i = 0; i < layouts.length; i++) {
    const current = layouts[i]!;
    const overlapping = layouts.filter((other, j) => j !== i && overlaps(current, other));

    if (overlapping.length === 0) continue;

    const usedCols = new Set(overlapping.map((o) => o.column));
    let col = 0;
    while (usedCols.has(col)) col += 1;
    current.column = col;

    const cluster = [current, ...overlapping];
    const maxCols = Math.max(...cluster.map((c) => c.column)) + 1;
    cluster.forEach((c) => {
      c.totalColumns = Math.max(c.totalColumns, maxCols);
    });
  }

  return layouts;
}

export function sessionsToLayoutedEvents(sessions: WeekSession[]): LayoutedWeekEvent[] {
  const byDay = new Map<string, LayoutedWeekEvent[]>();

  for (const session of sessions) {
    const dayISO = getBrDateISO(session.scheduled_at);
    const startMinutes = getBrMinutesSinceMidnight(session.scheduled_at);
    const duration = session.duration_minutes ?? 50;
    const endMinutes = startMinutes + duration;

    if (endMinutes <= WEEK_HOUR_START * 60 || startMinutes >= WEEK_HOUR_END * 60) {
      continue;
    }

    const event: LayoutedWeekEvent = {
      id: session.id,
      dayISO,
      patientName: session.patient?.name ?? session.title ?? 'Sessão',
      status: session.status,
      startMinutes,
      endMinutes,
      timeLabel: formatTimeRangeBr(session.scheduled_at, duration),
      column: 0,
      totalColumns: 1,
    };

    const list = byDay.get(dayISO) ?? [];
    list.push(event);
    byDay.set(dayISO, list);
  }

  const result: LayoutedWeekEvent[] = [];
  for (const dayEvents of byDay.values()) {
    result.push(...layoutDayEvents(dayEvents));
  }
  return result;
}

export function getNowIndicatorTopPx(now = new Date()): number | null {
  const minutes = getBrMinutesSinceMidnight(now.toISOString());
  if (minutes < WEEK_HOUR_START * 60 || minutes > WEEK_HOUR_END * 60) return null;
  return minutesToTopPx(minutes);
}

/** Converte posição Y no grid (px) em minutos desde meia-noite, arredondado em 15 min. */
export function getMinutesFromGridOffsetY(offsetY: number): number {
  const gridStart = WEEK_HOUR_START * 60;
  const gridEnd = WEEK_HOUR_END * 60;
  const rawMinutes = gridStart + (offsetY / WEEK_HOUR_HEIGHT_PX) * 60;
  const snapped = Math.round(rawMinutes / 15) * 15;
  return Math.max(gridStart, Math.min(gridEnd - 15, snapped));
}

export function minutesToTimeLabel(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${pad(hour)}:${pad(minute)}`;
}

export function getTimeFromGridOffsetY(offsetY: number): string {
  return minutesToTimeLabel(getMinutesFromGridOffsetY(offsetY));
}

/** Horário a partir de um clique dentro de uma faixa horária da visão semanal. */
export function getTimeFromHourSlotClick(hour: number, offsetYInHourPx: number): string {
  const snappedInHour = Math.round(((offsetYInHourPx / WEEK_HOUR_HEIGHT_PX) * 60) / 15) * 15;
  const clampedInHour = Math.max(0, Math.min(45, snappedInHour));
  const totalMinutes = hour * 60 + clampedInHour;
  return minutesToTimeLabel(
    Math.max(WEEK_HOUR_START * 60, Math.min(WEEK_HOUR_END * 60 - 15, totalMinutes)),
  );
}

export function formatDayHeader(iso: string, todayISO: string): { weekday: string; day: string; isToday: boolean } {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y!, (m ?? 1) - 1, d);
  const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(date).replace('.', '');
  return { weekday, day: String(d), isToday: iso === todayISO };
}
