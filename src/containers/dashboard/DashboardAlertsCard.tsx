import { useEffect, useState } from 'react';
import { InlineLoadingButton, ListPageSkeleton } from '@containers/loading';
import type { AlertItem } from './dashboard.types';
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

function AlertCard({ alert }: { alert: AlertItem }) {
  const isCrisis = alert.type === 'crisis';
  const accent = isCrisis ? 'border-l-alert' : 'border-l-mint';
  const tag = isCrisis ? 'Atenção' : 'Avanço';
  const tagClass = isCrisis ? 'bg-alert-bg text-alert' : 'bg-mint-50 text-mint-dark';

  return (
    <div className={`rounded-xl border border-slate-100 border-l-4 bg-slate-50 p-4 ${accent}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium text-charcoal">{alert.patient?.name ?? 'Paciente'}</p>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${tagClass}`}>{tag}</span>
      </div>
      {alert.notes && (
        <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-charcoal-muted">{alert.notes}</p>
      )}
      <p className="mt-2 text-[11px] text-charcoal-muted/60">
        {alert.hours_ago === 0 ? 'agora há pouco' : `há ${alert.hours_ago}h`}
        {isCrisis && alert.crisis_level ? ` · nível ${alert.crisis_level}` : ''}
      </p>
    </div>
  );
}

function AlertsEmptyState({ cleared = false }: { cleared?: boolean }) {
  if (cleared) {
    return (
      <div className="flex flex-col items-center rounded-3xl border border-dashed border-mint/30 bg-white px-5 py-12 text-center shadow-sm animate-fade-in">
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
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-gray-200 bg-white px-5 py-12 text-center shadow-sm">
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
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 id="alerts-title" className="font-display text-base font-semibold text-charcoal">
            Alertas nos Últimos 7 Dias
          </h2>
          {alerts.length > 0 && (
            <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-semibold text-primary-dark">
              {alerts.length}
            </span>
          )}
        </div>

        {alerts.length > 0 && (
          <InlineLoadingButton
            type="button"
            onClick={() => void handleClearAll()}
            loading={clearMutation.isPending}
            disabled={fadingOut}
            className="shrink-0 text-sm text-gray-500 transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            Marcar como lidos
          </InlineLoadingButton>
        )}
      </div>

      {loading ? (
        <ListPageSkeleton rows={2} rowClassName="h-24" />
      ) : showClearedEmpty ? (
        <AlertsEmptyState cleared />
      ) : showDefaultEmpty ? (
        <AlertsEmptyState />
      ) : (
        <div
          className={`max-h-96 overflow-y-auto rounded-3xl border border-gray-100 bg-white p-4 shadow-sm scrollbar-thin transition-opacity duration-300 ${
            fadingOut ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <div className="space-y-3">
            {alerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
