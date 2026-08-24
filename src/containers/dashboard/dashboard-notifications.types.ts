import type { ClinicalAlertSeverity } from './clinical-alerts.types';

export type DashboardNotificationGroup = 'alerts' | 'agenda' | 'inbox';
export type DashboardNotificationFilter = 'all' | DashboardNotificationGroup;

export type DashboardNotificationKind =
  | 'clinical'
  | 'crisis'
  | 'agenda'
  | 'note'
  | 'family'
  | 'classify'
  | 'overdue';

export type DashboardNotificationTone = 'alert' | 'error' | 'primary' | 'slate';

export interface DashboardNotificationItem {
  id: string;
  group: DashboardNotificationGroup;
  kind: DashboardNotificationKind;
  title: string;
  detail: string;
  to: string;
  tone: DashboardNotificationTone;
  sortAt: number;
  clinicalId?: string;
  severity?: ClinicalAlertSeverity;
}
