import { sessionWorkspacePath } from '@containers/session-workspace/session-workspace.utils';
import type { ClinicalAlertItem } from './clinical-alerts.types';
import {
  clinicalAlertSeverityLabel,
  clinicalAlertSourceLabel,
  clinicalRecordPath,
  formatAlertOccurredAt,
} from './clinical-alerts.utils';
import { formatScheduleTime } from './dashboard.time';
import type { AlertItem, BriefingData, ClinicTeamMember, InboxItem, ScheduleItem } from './dashboard.types';
import { buildInbox, formatCountdown, isCancelled, sessionPhase } from './home.utils';
import type { DashboardNotificationFilter, DashboardNotificationItem } from './dashboard-notifications.types';

export const DASHBOARD_NOTIFICATION_GROUP_LABEL: Record<DashboardNotificationItem['group'], string> = {
  alerts: 'Alertas e crises',
  agenda: 'Agendamentos',
  inbox: 'Pendências',
};

export const DASHBOARD_NOTIFICATION_FILTERS: Array<{
  id: DashboardNotificationFilter;
  label: string;
}> = [
  { id: 'all', label: 'Todas' },
  { id: 'alerts', label: DASHBOARD_NOTIFICATION_GROUP_LABEL.alerts },
  { id: 'agenda', label: DASHBOARD_NOTIFICATION_GROUP_LABEL.agenda },
  { id: 'inbox', label: DASHBOARD_NOTIFICATION_GROUP_LABEL.inbox },
];

export const DASHBOARD_NOTIFICATION_FILTER_EMPTY: Record<DashboardNotificationFilter, string> = {
  all: 'Nenhuma notificação no momento.',
  alerts: 'Nenhum alerta ou crise agora.',
  agenda: 'Nenhum agendamento na lista.',
  inbox: 'Nenhuma pendência agora.',
};

const INBOX_TONE: Record<InboxItem['tone'], DashboardNotificationItem['tone']> = {
  alert: 'alert',
  primary: 'primary',
  error: 'error',
  slate: 'slate',
};

export function buildDashboardNotifications(input: {
  clinicalAlerts: ClinicalAlertItem[];
  schedule?: ScheduleItem[];
  briefing?: BriefingData | null;
  canFinance?: boolean;
  now?: number;
}): DashboardNotificationItem[] {
  const now = input.now ?? Date.now();
  const clinical = input.clinicalAlerts.map(clinicalToNotification);
  const diaryCrises =
    clinical.length > 0 ? [] : (input.briefing?.alerts ?? []).filter((alert) => alert.type === 'crisis').map(diaryCrisisToNotification);

  const agenda = (input.schedule ?? [])
    .filter((item) => {
      if (isCancelled(item)) return false;
      const phase = sessionPhase(item, now);
      return phase === 'now' || phase === 'upcoming';
    })
    .map((item) => scheduleToNotification(item, now));

  const inbox = input.briefing
    ? buildInbox(input.briefing, Boolean(input.canFinance))
        .filter((item): item is Exclude<InboxItem, { kind: 'crisis' }> => item.kind !== 'crisis')
        .map(inboxToNotification)
    : [];

  return [...sortAlerts([...clinical, ...diaryCrises]), ...sortAgenda(agenda), ...inbox];
}

export function buildClinicDashboardNotifications(input: {
  clinicalAlerts: ClinicalAlertItem[];
  pendingFamilyLinks?: number;
  team?: ClinicTeamMember[];
  now?: number;
}): DashboardNotificationItem[] {
  const now = input.now ?? Date.now();
  const clinical = input.clinicalAlerts.map(clinicalToNotification);
  const agenda = (input.team ?? [])
    .filter((member) => member.next_at && new Date(member.next_at).getTime() >= now)
    .map((member) => teamToNotification(member, now));

  const inbox: DashboardNotificationItem[] = [];
  const pending = input.pendingFamilyLinks ?? 0;
  if (pending > 0) {
    inbox.push({
      id: 'clinic-family',
      group: 'inbox',
      kind: 'family',
      title: 'Vínculos de família pendentes',
      detail: pending === 1 ? '1 paciente ainda sem acesso da família' : `${pending} pacientes ainda sem acesso da família`,
      to: '/patients',
      tone: 'slate',
      sortAt: now,
    });
  }

  return [...sortAlerts(clinical), ...sortAgenda(agenda), ...inbox];
}

export function groupDashboardNotifications(
  items: DashboardNotificationItem[],
): Array<{ group: DashboardNotificationItem['group']; label: string; items: DashboardNotificationItem[] }> {
  const order: DashboardNotificationItem['group'][] = ['alerts', 'agenda', 'inbox'];
  return order
    .map((group) => ({
      group,
      label: DASHBOARD_NOTIFICATION_GROUP_LABEL[group],
      items: items.filter((item) => item.group === group),
    }))
    .filter((section) => section.items.length > 0);
}

export function filterDashboardNotifications(
  items: DashboardNotificationItem[],
  filter: DashboardNotificationFilter,
): DashboardNotificationItem[] {
  if (filter === 'all') return items;
  return items.filter((item) => item.group === filter);
}

export function dashboardNotificationFilterCount(
  items: DashboardNotificationItem[],
  filter: DashboardNotificationFilter,
): number {
  return filterDashboardNotifications(items, filter).length;
}

export function dashboardNotificationBadgeCount(items: DashboardNotificationItem[]): number {
  return items.length;
}

export function dashboardNotificationsHaveSevere(items: DashboardNotificationItem[]): boolean {
  return items.some((item) => item.severity === 'SEVERE' || item.kind === 'crisis' || item.tone === 'error');
}

function clinicalToNotification(alert: ClinicalAlertItem): DashboardNotificationItem {
  return {
    id: `clinical-${alert.id}`,
    group: 'alerts',
    kind: 'clinical',
    title: alert.patient_name,
    detail: `${clinicalAlertSeverityLabel(alert.severity)} · ${clinicalAlertSourceLabel(alert.source)} · ${formatAlertOccurredAt(alert.occurred_at)}`,
    to: clinicalRecordPath(alert.patient_id),
    tone: alert.severity === 'SEVERE' ? 'error' : 'alert',
    sortAt: new Date(alert.occurred_at).getTime() || 0,
    clinicalId: alert.id,
    severity: alert.severity,
  };
}

function diaryCrisisToNotification(alert: AlertItem): DashboardNotificationItem {
  const time = alert.hours_ago === 0 ? 'agora' : `há ${alert.hours_ago}h`;
  return {
    id: `crisis-${alert.id}`,
    group: 'alerts',
    kind: 'crisis',
    title: alert.patient?.name ?? 'Paciente',
    detail: alert.crisis_level ? `Crise nível ${alert.crisis_level}/5 · ${time}` : `Crise registrada · ${time}`,
    to: alert.patient?.id ? `/patients/${alert.patient.id}/checkins?date=${alert.entry_date}` : '/patients',
    tone: 'alert',
    sortAt: Date.now() - alert.hours_ago * 3_600_000,
    severity: alert.crisis_level && alert.crisis_level >= 4 ? 'SEVERE' : 'MODERATE',
  };
}

function scheduleToNotification(item: ScheduleItem, now: number): DashboardNotificationItem {
  const phase = sessionPhase(item, now);
  const time = formatScheduleTime(item.scheduled_at);
  const name = item.patient?.name ?? item.title ?? 'Sessão';
  const when = phase === 'now' ? `Agora · ${time}` : `${formatCountdown(item.scheduled_at, now) || time} · ${time}`;

  return {
    id: `agenda-${item.id}`,
    group: 'agenda',
    kind: 'agenda',
    title: name,
    detail: when,
    to: item.patient ? sessionWorkspacePath(item.patient.id, item.id) : '/calendar',
    tone: phase === 'now' ? 'primary' : 'slate',
    sortAt: new Date(item.scheduled_at).getTime() || now,
  };
}

function teamToNotification(member: ClinicTeamMember, now: number): DashboardNotificationItem {
  const time = member.next_at ? formatScheduleTime(member.next_at) : '';
  const who = member.next_patient ?? 'Próxima sessão';
  return {
    id: `team-${member.id}`,
    group: 'agenda',
    kind: 'agenda',
    title: who,
    detail: time ? `${member.name} · ${time}` : member.name,
    to: '/calendar',
    tone: 'primary',
    sortAt: member.next_at ? new Date(member.next_at).getTime() : now,
  };
}

function inboxToNotification(item: Exclude<InboxItem, { kind: 'crisis' }>): DashboardNotificationItem {
  return {
    id: `inbox-${item.id}`,
    group: 'inbox',
    kind: item.kind,
    title: item.title,
    detail: item.detail,
    to: item.to,
    tone: INBOX_TONE[item.tone],
    sortAt: 0,
  };
}

function sortAlerts(items: DashboardNotificationItem[]): DashboardNotificationItem[] {
  return [...items].sort((a, b) => {
    const severeA = a.severity === 'SEVERE' ? 1 : 0;
    const severeB = b.severity === 'SEVERE' ? 1 : 0;
    if (severeA !== severeB) return severeB - severeA;
    return b.sortAt - a.sortAt;
  });
}

function sortAgenda(items: DashboardNotificationItem[]): DashboardNotificationItem[] {
  return [...items].sort((a, b) => a.sortAt - b.sortAt);
}
