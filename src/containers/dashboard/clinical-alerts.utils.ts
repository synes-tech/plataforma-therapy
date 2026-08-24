import type { ClinicalAlertItem, ClinicalAlertSource } from './clinical-alerts.types';

export const CLINICAL_ALERTS_QUERY_KEY = ['clinical-alerts', 'UNREAD'] as const;
export const CLINICAL_ALERTS_POLL_MS = 5 * 60 * 1000;
export const SEEN_SEVERE_STORAGE_KEY = 'unithery.clinical-alerts.seen-severe';

export function clinicalAlertSourceLabel(source: ClinicalAlertSource): string {
  switch (source) {
    case 'COPILOT_B2C':
      return 'Acompanhante IA';
    case 'DIARY':
      return 'Diário de humor';
    case 'CHECKIN':
      return 'Check-in';
    case 'MANUAL':
      return 'Registro manual';
    default:
      return 'Alerta clínico';
  }
}

export function clinicalAlertSeverityLabel(severity: ClinicalAlertItem['severity']): string {
  if (severity === 'SEVERE') return 'Urgente';
  if (severity === 'MODERATE') return 'Atenção';
  return 'Baixo';
}

export function clinicalRecordPath(patientId: string): string {
  return `/patients/${patientId}/copilot`;
}

export function clinicalAlertsButtonLabel(count: number): string {
  if (count <= 0) return 'Atenção, você tem 0 alertas';
  if (count === 1) return 'Atenção, você tem 1 alerta';
  return `Atenção, você tem ${count} alertas`;
}

export function clinicalAlertsButtonTone(
  severeUnreadCount: number,
): 'severe' | 'attention' {
  return severeUnreadCount > 0 ? 'severe' : 'attention';
}

export function shouldToastSevereAlert(alert: Pick<ClinicalAlertItem, 'severity' | 'notify_now' | 'status'>): boolean {
  return alert.status === 'UNREAD' && alert.severity === 'SEVERE' && alert.notify_now !== false;
}

export function newSevereAlertIds(
  alerts: ClinicalAlertItem[],
  previouslySeen: ReadonlySet<string>,
): string[] {
  return alerts.filter((alert) => shouldToastSevereAlert(alert) && !previouslySeen.has(alert.id)).map((alert) => alert.id);
}

export function formatAlertOccurredAt(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const diffMin = Math.max(0, Math.round((now.getTime() - date.getTime()) / 60_000));
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `há ${diffMin} min`;
  const hours = Math.floor(diffMin / 60);
  if (hours < 24) return hours === 1 ? 'há 1 hora' : `há ${hours} horas`;
  return date.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function readSeenSevereIds(storage: Pick<Storage, 'getItem'> | null = defaultSessionStorage()): Set<string> {
  if (!storage) return new Set();
  try {
    const raw = storage.getItem(SEEN_SEVERE_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item): item is string => typeof item === 'string'));
  } catch {
    return new Set();
  }
}

export function writeSeenSevereIds(
  ids: Iterable<string>,
  storage: Pick<Storage, 'setItem'> | null = defaultSessionStorage(),
): void {
  if (!storage) return;
  storage.setItem(SEEN_SEVERE_STORAGE_KEY, JSON.stringify([...ids]));
}

function defaultSessionStorage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}
