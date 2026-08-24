import { formatCurrency } from '@features/billing/format';
import { sessionWorkspacePath } from '@containers/session-workspace/session-workspace.utils';
import type {
  AlertItem,
  BriefingData,
  BriefingSummary,
  DiaryMonthCheckin,
  InboxItem,
  PortfolioMix,
  ScheduleItem,
  SessionPhase,
  WeekDayPoint,
} from './dashboard.types';

const CANCELLED = new Set(['cancelled', 'canceled', 'no_show']);
const WEEKDAY_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

export function emptySummary(): BriefingSummary {
  return {
    sessions_today: 0,
    sessions_this_week: 0,
    active_patients_count: 0,
    alerts_count: 0,
    crisis_count: 0,
    pending_notes_count: 0,
    family_unlinked_count: 0,
    occupancy_pct: 0,
  };
}

export function withSummaryDefaults(summary?: Partial<BriefingSummary>): BriefingSummary {
  return { ...emptySummary(), ...summary };
}

export function formatLongDate(isoDate: string, now = new Date()): string {
  const value = isoDate ? new Date(`${isoDate}T12:00:00-03:00`) : now;
  if (Number.isNaN(value.getTime())) {
    return new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(now);
  }
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Sao_Paulo',
  }).format(value);
}

export function sessionEndMs(item: ScheduleItem): number {
  const start = new Date(item.scheduled_at).getTime();
  const minutes = item.duration_minutes && item.duration_minutes > 0 ? item.duration_minutes : 50;
  return start + minutes * 60_000;
}

export function isCancelled(item: ScheduleItem): boolean {
  return CANCELLED.has(item.status);
}

export function sessionPhase(item: ScheduleItem, now = Date.now()): SessionPhase {
  if (isCancelled(item)) return 'missed';
  const start = new Date(item.scheduled_at).getTime();
  const end = sessionEndMs(item);
  if (Number.isNaN(start)) return 'upcoming';
  if (now >= start && now < end) return 'now';
  if (now >= end) return item.status === 'completed' || item.evolution_status === 'approved' ? 'done' : 'done';
  return 'upcoming';
}

export function pickNextSession(schedule: ScheduleItem[], now = Date.now()): ScheduleItem | null {
  return (
    schedule
      .filter((item) => !isCancelled(item))
      .filter((item) => sessionEndMs(item) > now)
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0] ?? null
  );
}

export function formatCountdown(iso: string, now = Date.now()): string {
  const start = new Date(iso).getTime();
  if (Number.isNaN(start)) return '';
  const diff = start - now;
  if (diff <= 0) return 'agora';
  const minutes = Math.round(diff / 60_000);
  if (minutes < 60) return `em ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `em ${hours}h ${rest}min` : `em ${hours}h`;
}

export function occupancyHint(pct: number, sessionsWeek: number): string {
  if (sessionsWeek === 0) return 'Nenhuma sessão nesta semana';
  if (pct >= 80) return `${sessionsWeek} sessões · semana cheia`;
  if (pct >= 40) return `${sessionsWeek} sessões · ritmo saudável`;
  return `${sessionsWeek} sessões · ainda há folga`;
}

export function briefingSubtitle(summary?: Partial<BriefingSummary>): string {
  const data = withSummaryDefaults(summary);
  if (data.sessions_today === 0) {
    return data.pending_notes_count > 0
      ? `Agenda livre hoje · ${data.pending_notes_count} ${data.pending_notes_count === 1 ? 'evolução' : 'evoluções'} em aberto`
      : 'Nenhum atendimento programado para hoje — bom momento para revisar prontuários.';
  }
  if (data.sessions_today === 1) return 'Você tem 1 atendimento programado para hoje.';
  return `Você tem ${data.sessions_today} atendimentos programados para hoje.`;
}

export function inboxCount(data?: BriefingData, canFinance = false): number {
  if (!data) return 0;
  const crisis = data.alerts.filter((alert) => alert.type === 'crisis').length;
  const notes = data.summary.pending_notes_count ?? data.pending_notes?.length ?? 0;
  const family = data.summary.family_unlinked_count ?? data.family_unlinked?.length ?? 0;
  const classify = canFinance ? (data.finance?.classify_count ?? 0) : 0;
  const overdue = canFinance ? (data.finance?.overdue_count ?? 0) : 0;
  return crisis + notes + family + classify + overdue;
}

export function buildInbox(data: BriefingData, canFinance: boolean): InboxItem[] {
  const items: InboxItem[] = [];

  for (const alert of data.alerts.filter((entry) => entry.type === 'crisis')) {
    items.push({
      id: `crisis-${alert.id}`,
      kind: 'crisis',
      title: alert.patient?.name ?? 'Paciente',
      detail: crisisDetail(alert),
      to: alert.patient?.id ? `/patients/${alert.patient.id}/checkins?date=${alert.entry_date}` : '/patients',
      tone: 'alert',
    });
  }

  for (const note of data.pending_notes ?? []) {
    items.push({
      id: `note-${note.schedule_id ?? note.patient_id}`,
      kind: 'note',
      title: note.patient_name,
      detail: note.status === 'draft' ? 'Relatório em rascunho' : 'Evolução ainda não registrada',
      to: sessionWorkspacePath(note.patient_id, note.schedule_id),
      tone: 'primary',
    });
  }

  if (canFinance && (data.finance?.classify_count ?? 0) > 0) {
    items.push({
      id: 'classify',
      kind: 'classify',
      title: 'Sessões a classificar',
      detail: `${data.finance?.classify_count} sessão${data.finance?.classify_count === 1 ? '' : 'ões'} sem status de cobrança`,
      to: '/financeiro',
      tone: 'slate',
    });
  }

  for (const patient of (data.family_unlinked ?? []).slice(0, 3)) {
    items.push({
      id: `family-${patient.id}`,
      kind: 'family',
      title: patient.name,
      detail: 'Família ainda sem vínculo no app',
      to: `/patients/${patient.id}`,
      tone: 'slate',
    });
  }

  if (canFinance && (data.finance?.overdue_count ?? 0) > 0) {
    items.push({
      id: 'overdue',
      kind: 'overdue',
      title: 'Títulos atrasados',
      detail: `${data.finance?.overdue_count} · ${formatCurrency(data.finance?.overdue_cents ?? 0)}`,
      to: '/financeiro',
      tone: 'error',
    });
  }

  return items.slice(0, 8);
}

function crisisDetail(alert: AlertItem): string {
  const time = alert.hours_ago === 0 ? 'agora' : `há ${alert.hours_ago}h`;
  if (alert.crisis_level) return `Crise nível ${alert.crisis_level}/5 · ${time}`;
  return `Crise registrada · ${time}`;
}

export function portfolioSlices(mix?: PortfolioMix) {
  const data = mix ?? { with_family: 0, without_family: 0, stale_21d: 0 };
  return [
    { id: 'family', label: 'Com família', value: data.with_family, color: '#1A86E2' },
    { id: 'unlinked', label: 'Sem vínculo', value: data.without_family, color: '#94A3B8' },
    { id: 'stale', label: 'Sem sessão 21d', value: data.stale_21d, color: '#F59E0B' },
  ].filter((slice) => slice.value > 0);
}

export const WEEK_BAR_TICK = 2;
export const WEEK_BAR_DEFAULT_MAX = 10;

export function weekBarMax(points: WeekDayPoint[]): number {
  const raw = Math.max(0, ...points.map((point) => point.count));
  const needed = Math.ceil(raw / WEEK_BAR_TICK) * WEEK_BAR_TICK;
  return Math.max(WEEK_BAR_DEFAULT_MAX, needed);
}

export function weekBarTicks(max: number): number[] {
  const ticks: number[] = [];
  for (let value = 0; value <= max; value += WEEK_BAR_TICK) ticks.push(value);
  return ticks;
}

export function weekdayLabel(date: string): string {
  const value = new Date(`${date}T12:00:00-03:00`);
  if (Number.isNaN(value.getTime())) return date;
  return WEEKDAY_SHORT[value.getDay()] ?? date;
}

export function monthPartsFromKey(month: string): { year: number; month: number } {
  const [yearRaw, monthRaw] = month.split('-');
  return { year: Number(yearRaw), month: Number(monthRaw) };
}

export function buildMonthCells(month: string): Array<{ day: number | null; dateKey?: string }> {
  const { year, month: monthIndex } = monthPartsFromKey(month);
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 1 || monthIndex > 12) {
    return [];
  }
  const firstDow = new Date(year, monthIndex - 1, 1).getDay();
  const daysInMonth = new Date(year, monthIndex, 0).getDate();
  const cells: Array<{ day: number | null; dateKey?: string }> = [];
  for (let i = 0; i < firstDow; i += 1) cells.push({ day: null });
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      day,
      dateKey: `${year}-${String(monthIndex).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    });
  }
  return cells;
}

export function checkinsForDay(entries: DiaryMonthCheckin[] | undefined, dateKey: string): DiaryMonthCheckin[] {
  return (entries ?? [])
    .filter((entry) => entry.entry_date === dateKey)
    .sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
}

export function formatDiaryCheckinTime(iso?: string | null): string {
  if (!iso) return '';
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(value);
}

export function monthTitle(month: string): string {
  const { year, month: monthIndex } = monthPartsFromKey(month);
  const names = [
    'Janeiro',
    'Fevereiro',
    'Março',
    'Abril',
    'Maio',
    'Junho',
    'Julho',
    'Agosto',
    'Setembro',
    'Outubro',
    'Novembro',
    'Dezembro',
  ];
  return `${names[monthIndex - 1] ?? month} de ${year}`;
}
