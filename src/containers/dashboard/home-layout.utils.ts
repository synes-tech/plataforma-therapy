import { patientUsagePercent } from '@shared/lib/therapist-plans';
import type { BriefingData, CompletedSessionItem, WeekDayPoint } from './dashboard.types';

export const HOME_AGENDA_EMPTY = 'Aqui aparecerão as agendas de hoje.';
export const HOME_ATTENTION_EMPTY = 'Aqui aparecerão os alertas.';
export const HOME_SPLIT_VISIBLE_ROWS = 5;
export const HOME_SPLIT_ROW_PX = 88;
export const HOME_SPLIT_LIST_PX = HOME_SPLIT_VISIBLE_ROWS * HOME_SPLIT_ROW_PX;

export type AttendanceRange = 'week' | 'month' | 'year';

export const ATTENDANCE_RANGE_OPTIONS: Array<{ id: AttendanceRange; label: string }> = [
  { id: 'week', label: 'Semana' },
  { id: 'month', label: 'Mês' },
  { id: 'year', label: 'Ano' },
];

export function attendanceRangeHint(range: AttendanceRange): string {
  if (range === 'week') return 'Quantidade de sessões na sua agenda em cada um dos últimos 7 dias.';
  if (range === 'month') return 'Quantidade de sessões na sua agenda em cada dia deste mês.';
  return 'Quantidade de sessões na sua agenda em cada mês deste ano.';
}

export function attendanceRangeDescription(range: AttendanceRange): string {
  if (range === 'week') {
    return 'Cada barra é um dia. A altura é o número de sessões agendadas naquele dia. Cancelamentos e faltas não entram na conta.';
  }
  if (range === 'month') {
    return 'Cada barra é um dia deste mês. A altura é o número de sessões agendadas naquele dia. Cancelamentos e faltas não entram na conta.';
  }
  return 'Cada barra é um mês deste ano. A altura é o número de sessões agendadas naquele mês. Cancelamentos e faltas não entram na conta.';
}

export function attendanceAxisCaption(range: AttendanceRange): { x: string; y: string } {
  if (range === 'week') return { x: 'Eixo horizontal: dia da semana', y: 'Eixo vertical: quantidade de sessões' };
  if (range === 'month') return { x: 'Eixo horizontal: dia do mês', y: 'Eixo vertical: quantidade de sessões' };
  return { x: 'Eixo horizontal: mês do ano', y: 'Eixo vertical: quantidade de sessões' };
}

export function attendanceLegendLabel(): string {
  return 'Sessões agendadas (exceto canceladas e faltas)';
}

export function attendancePeriodTotalLabel(total: number): string {
  if (total === 1) return '1 sessão no período';
  return `${total} sessões no período`;
}

export function attendanceSeries(data: Pick<BriefingData, 'week_days' | 'month_days' | 'year_months'>, range: AttendanceRange): WeekDayPoint[] {
  if (range === 'month') return data.month_days ?? [];
  if (range === 'year') return data.year_months ?? [];
  return data.week_days ?? [];
}

export function denseBarLabelStep(count: number): number {
  if (count <= 12) return 1;
  if (count <= 20) return 2;
  return 3;
}

export function quotaBarPercent(activeCount: number, totalLimit: number): number {
  return patientUsagePercent(activeCount, totalLimit);
}

export function quotaBarLabel(activeCount: number, totalLimit: number, unlimited: boolean): string {
  if (unlimited || totalLimit <= 0) return 'Plano sem limite de carteira';
  return `${activeCount}/${totalLimit}`;
}

export function completedSessionsTotal(data?: BriefingData): number {
  return data?.completed_sessions?.total ?? data?.summary.sessions_completed_total ?? 0;
}

export function completedSessionsToday(data?: BriefingData): number {
  const fromApi = data?.completed_sessions?.today ?? data?.summary.sessions_completed_today;
  if (typeof fromApi === 'number') return fromApi;
  return (data?.schedule ?? []).filter((item) => item.status === 'completed').length;
}

export function scheduledSessionsToday(data?: BriefingData): number {
  const fromSchedule = (data?.schedule ?? []).length;
  const fromSummary = data?.summary.sessions_today;
  if (typeof fromSummary === 'number') return Math.max(fromSummary, fromSchedule);
  return fromSchedule;
}

export function todaySessionsRatioLabel(done: number, scheduled: number): string {
  return `${done}/${scheduled}`;
}

export function completedSessionItems(data: BriefingData | undefined, scope: 'total' | 'today'): CompletedSessionItem[] {
  if (scope === 'today') {
    const fromApi = data?.completed_sessions?.items_today;
    if (fromApi) return fromApi;
    return (data?.schedule ?? [])
      .filter((item) => item.status === 'completed' && item.patient)
      .map((item) => ({
        id: item.id,
        patient_id: item.patient!.id,
        patient_name: item.patient!.name,
        occurred_at: item.scheduled_at,
        status: item.status,
        title: item.title,
        source: 'schedule' as const,
      }));
  }
  return data?.completed_sessions?.items_total ?? [];
}

export function formatCompletedWhen(iso: string): string {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(value);
}

export function completedStatusLabel(status: string): string {
  if (status === 'approved') return 'Evolução aprovada';
  if (status === 'draft') return 'Rascunho';
  if (status === 'completed') return 'Sessão concluída';
  if (status === 'pending') return 'Em aberto';
  return status;
}

export function financeReceivedCents(data?: BriefingData): number {
  return data?.finance?.received_cents ?? 0;
}

export function financeReceivableCents(data?: BriefingData): number {
  return data?.finance?.receivable_cents ?? 0;
}

export function financeOverdueCents(data?: BriefingData): number {
  return data?.finance?.overdue_cents ?? 0;
}

export function financeNetCents(data?: BriefingData): number {
  if (typeof data?.finance?.net_cents === 'number') return data.finance.net_cents;
  return financeReceivedCents(data) - (data?.finance?.expenses_cents ?? 0);
}
