import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { InlineLoadingButton, ListPageSkeleton } from '@containers/loading';
import type { AlertItem } from './dashboard.types';
import {
  getAlertCheckinPath,
  getAlertEmoji,
  getAlertSummary,
} from './dashboard-alert-summary.utils';
import { useClearDashboardAlerts } from './useClearDashboardAlerts';

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

function AlertRow({ alert }: { alert: AlertItem }) {
  const isCrisis = alert.type === 'crisis';
  const checkinPath = getAlertCheckinPath(alert);

  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl border border-[#EDE4DC]/45 border-l-[3px] bg-white/45 px-3 py-2.5 ${isCrisis ? 'border-l-alert' : 'border-l-mint'}`}
    >
      <span className="shrink-0 text-base leading-none" aria-hidden>
        {getAlertEmoji(alert.type)}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-tight text-charcoal">
          {alert.patient?.name ?? 'Paciente'}
        </p>
        <p className="mt-0.5 truncate text-[11px] leading-snug text-charcoal-muted">
          {getAlertSummary(alert)}
        </p>
      </div>

      {checkinPath ? (
        <Link
          to={checkinPath}
          className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-white px-3 text-xs font-semibold text-primary transition-colors hover:border-primary/40 hover:bg-primary-50"
        >
          Ver
        </Link>
      ) : (
        <span className="inline-flex h-8 shrink-0 items-center rounded-lg px-3 text-xs text-charcoal-muted/50">
          —
        </span>
      )}
    </div>
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
  const [fadingOut, setFadingOut] = useState(false);
  const [justCleared, setJustCleared] = useState(false);

  useEffect(() => {
    if (alerts.length > 0) {
      setJustCleared(false);
    }
  }, [alerts.length]);

  async function handleClearAll() {
    if (alerts.length === 0 || clearMutation.isPending) return;

    setFadingOut(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 280));
      await clearMutation.mutateAsync();
      setJustCleared(true);
    } finally {
      setFadingOut(false);
    }
  }

  const showClearedEmpty = justCleared && alerts.length === 0;
  const showDefaultEmpty = !justCleared && alerts.length === 0;

  return (
    <section className="lg:col-span-4" aria-labelledby="alerts-title">
      <div className="mb-4 flex min-w-0 items-center gap-2">
        <h2 id="alerts-title" className="font-display text-base font-semibold text-charcoal">
          Alertas nos Últimos 7 Dias
        </h2>
        {alerts.length > 0 && (
          <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-semibold text-primary-dark">
            {alerts.length}
          </span>
        )}
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
            {alerts.map((alert) => (
              <AlertRow key={alert.id} alert={alert} />
            ))}
          </div>

          <div className="flex justify-end border-t border-[#EDE4DC]/40 px-3 py-2.5">
            <InlineLoadingButton
              type="button"
              onClick={() => void handleClearAll()}
              loading={clearMutation.isPending}
              disabled={fadingOut}
              className="text-xs text-charcoal-muted transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Marcar como lidos
            </InlineLoadingButton>
          </div>
        </div>
      )}
    </section>
  );
}
