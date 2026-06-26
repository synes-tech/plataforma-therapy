import type { BriefingSummary } from './dashboard.types';

export type DashboardQuickStatId = 'active_patients' | 'sessions_week' | 'pending_alerts';

export type DashboardQuickStatAction =
  | { type: 'link'; to: string; ariaLabel: string }
  | { type: 'scroll'; targetId: string; ariaLabel: string };

export interface DashboardQuickStatDefinition {
  id: DashboardQuickStatId;
  label: string;
  tone: 'primary' | 'mint' | 'alert';
  getValue: (summary?: BriefingSummary) => number;
  action?: DashboardQuickStatAction;
}

/** Atalhos dos cards do dashboard — adicione `action` conforme novas rotas forem definidas. */
export const DASHBOARD_QUICK_STATS: DashboardQuickStatDefinition[] = [
  {
    id: 'active_patients',
    label: 'Pacientes ativos',
    tone: 'primary',
    getValue: (summary) => summary?.active_patients_count ?? 0,
    action: {
      type: 'link',
      to: '/patients',
      ariaLabel: 'Ver listagem de pacientes ativos',
    },
  },
  {
    id: 'sessions_week',
    label: 'Sessões na semana',
    tone: 'mint',
    getValue: (summary) => summary?.sessions_this_week ?? 0,
    action: {
      type: 'link',
      to: '/calendar',
      ariaLabel: 'Abrir agenda da semana',
    },
  },
  {
    id: 'pending_alerts',
    label: 'Alertas pendentes',
    tone: 'alert',
    getValue: (summary) => summary?.alerts_count ?? 0,
    action: {
      type: 'scroll',
      targetId: 'alerts-title',
      ariaLabel: 'Ir para alertas dos pacientes',
    },
  },
];
