import type { AlertItem } from './dashboard.types';

export function getAlertEmoji(type: AlertItem['type']): string {
  return type === 'crisis' ? '🚨' : '✨';
}

export function getAlertSummary(alert: AlertItem): string {
  const trimmed = alert.notes?.trim();
  if (trimmed) {
    return trimmed.length > 72 ? `${trimmed.slice(0, 72)}…` : trimmed;
  }

  const timeLabel = alert.hours_ago === 0 ? 'agora' : `há ${alert.hours_ago}h`;

  if (alert.type === 'crisis') {
    return alert.crisis_level
      ? `Crise registrada · nível ${alert.crisis_level}/5 · ${timeLabel}`
      : `Crise registrada · ${timeLabel}`;
  }

  return `Avanço no diário familiar · ${timeLabel}`;
}

export function getAlertCheckinPath(alert: AlertItem): string | null {
  if (!alert.patient?.id) return null;
  return `/patients/${alert.patient.id}/checkins?date=${alert.entry_date}`;
}

/** Crises aparecem primeiro na lista do dashboard. */
export function sortAlertsByPriority(alerts: AlertItem[]): AlertItem[] {
  return [...alerts].sort((left, right) => {
    if (left.type === 'crisis' && right.type !== 'crisis') return -1;
    if (left.type !== 'crisis' && right.type === 'crisis') return 1;
    return 0;
  });
}

export function getCrisisLevelLabel(level: number | null): string | null {
  if (!level || level < 1) return null;
  return `Nível ${level}/5`;
}

export function getAlertRowClassName(type: AlertItem['type']): string {
  if (type === 'crisis') {
    return 'border-l-alert bg-alert-bg/35';
  }
  return 'border-l-mint bg-white/45';
}

export function getAlertDismissAriaLabel(alert: AlertItem): string {
  const patient = alert.patient?.name ?? 'paciente';
  if (alert.type === 'crisis') {
    return `Dispensar alerta de crise de ${patient}`;
  }
  return `Dispensar alerta de ${patient}`;
}
