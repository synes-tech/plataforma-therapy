import { useEffect, useMemo, useState } from 'react';
import { InlineLoadingButton, ListPageSkeleton } from '@containers/loading';
import type { AlertItem } from './dashboard.types';
import { sortAlertsByPriority } from './dashboard-alert-summary.utils';
import { DashboardAlertRow } from './DashboardAlertRow';
import { useClearDashboardAlerts } from './useClearDashboardAlerts';
import { useDismissDashboardAlert } from './useDismissDashboardAlert';
import {
  DASHBOARD_ALERTS_SUBTITLE,
  DASHBOARD_ALERTS_SUBTITLE_CLASS,
  DASHBOARD_ALERTS_TITLE,
  DASHBOARD_ALERTS_TITLE_CLASS,
} from './dashboard-alerts.constants';

function CheckCircleIcon() {
  return (
    <svg className="h-8 w-8 text-mint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function MutedBellIllustration() {
  return (
    <svg className="h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" opacity="0.35" />
    </svg>
  );
}

function AlertsEmptyState({ cleared = false }: { cleared?: boolean }) {
  if (cleared) {
    return (
      <div className="flex flex-col items-center rounded-3xl border border-dashed border-mint/30 dashboard-card-surface px-5 py-12 text-center animate-fade-in">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-mint-50">
          <CheckCircleIcon />
        </div>
        <p className="text-sm font-medium text-charcoal">Tudo limpo!</p>
        <p className="mt-1 max-w-xs text-sm text-charcoal-muted/80">
          Você não possui alertas pendentes.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-[#EDE4DC] dashboard-card-surface px-5 py-12 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50">
        <MutedBellIllustration />
      </div>
      <p className="text-sm font-medium text-charcoal">Tudo tranquilo por aqui</p>
      <p className="mt-1 max-w-xs text-sm text-charcoal-muted/80">
        Nenhum alerta recente do diário familiar. As atualizações aparecerão aqui automaticamente.
      </p>
    </div>
  );
}

interface DashboardAlertsCardProps {
  alerts: AlertItem[];
  loading?: boolean;
}

export function DashboardAlertsCard({ alerts, loading }: DashboardAlertsCardProps) {
  const clearMutation = useClearDashboardAlerts();
  const dismissMutation = useDismissDashboardAlert();
  const [fadingOut, setFadingOut] = useState(false);
  const [justCleared, setJustCleared] = useState(false);
  const [removingIds, setRemovingIds] = useState<Set<string>>(() => new Set());
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  const sortedAlerts = useMemo(() => sortAlertsByPriority(alerts), [alerts]);

  useEffect(() => {
    if (alerts.length > 0) {
      setJustCleared(false);
    }
  }, [alerts.length]);

  async function handleClearAll() {
    if (alerts.length === 0 || clearMutation.isPending || dismissMutation.isPending) return;

    setFadingOut(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 280));
      await clearMutation.mutateAsync();
      setJustCleared(true);
    } finally {
      setFadingOut(false);
    }
  }

  async function handleDismissOne(alertId: string) {
    if (dismissMutation.isPending || clearMutation.isPending) return;

    setDismissingId(alertId);
    setRemovingIds((current) => new Set(current).add(alertId));

    try {
      await new Promise((resolve) => setTimeout(resolve, 220));
      await dismissMutation.mutateAsync(alertId);

      if (alerts.length <= 1) {
        setJustCleared(true);
      }
    } catch {
      setRemovingIds((current) => {
        const next = new Set(current);
        next.delete(alertId);
        return next;
      });
    } finally {
      setDismissingId(null);
    }
  }

  const showClearedEmpty = justCleared && alerts.length === 0;
  const showDefaultEmpty = !justCleared && alerts.length === 0;

  return (
    <section className="lg:col-span-4" aria-labelledby="alerts-title" aria-describedby="alerts-subtitle">
      <div className="mb-4 flex min-w-0 items-start gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="alerts-title" className={DASHBOARD_ALERTS_TITLE_CLASS}>
              {DASHBOARD_ALERTS_TITLE}
            </h2>
            {alerts.length > 0 && (
              <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-semibold text-primary-dark">
                {alerts.length}
              </span>
            )}
          </div>
          <p id="alerts-subtitle" className={DASHBOARD_ALERTS_SUBTITLE_CLASS}>
            {DASHBOARD_ALERTS_SUBTITLE}
          </p>
        </div>
      </div>

      {loading ? (
        <ListPageSkeleton rows={3} rowClassName="h-12" />
      ) : showClearedEmpty ? (
        <AlertsEmptyState cleared />
      ) : showDefaultEmpty ? (
        <AlertsEmptyState />
      ) : (
        <div
          className={`dashboard-card-surface max-h-96 overflow-hidden rounded-3xl transition-opacity duration-300 ${
            fadingOut ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <div className="max-h-80 space-y-2 overflow-y-auto p-3 scrollbar-thin">
            {sortedAlerts.map((alert) => (
              <DashboardAlertRow
                key={alert.id}
                alert={alert}
                onDismiss={(alertId) => void handleDismissOne(alertId)}
                dismissing={dismissingId === alert.id}
                removing={removingIds.has(alert.id)}
              />
            ))}
          </div>

          <div className="flex flex-col gap-1 border-t border-[#EDE4DC]/40 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] text-charcoal-muted/80">
              Dispense um alerta com <span className="font-medium text-charcoal-muted">Lido</span> ou limpe todos de uma vez.
            </p>
            <InlineLoadingButton
              type="button"
              onClick={() => void handleClearAll()}
              loading={clearMutation.isPending}
              disabled={fadingOut || dismissMutation.isPending}
              className="shrink-0 text-xs text-charcoal-muted transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Marcar todos como lidos
            </InlineLoadingButton>
          </div>
        </div>
      )}
    </section>
  );
}
