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
