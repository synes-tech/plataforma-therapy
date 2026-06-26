import { Link } from 'react-router-dom';
import type { AlertItem } from './dashboard.types';
import {
  getAlertCheckinPath,
  getAlertDismissAriaLabel,
  getAlertEmoji,
  getAlertRowClassName,
  getAlertSummary,
  getCrisisLevelLabel,
} from './dashboard-alert-summary.utils';

function DismissIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

interface DashboardAlertRowProps {
  alert: AlertItem;
  onDismiss: (alertId: string) => void;
  dismissing?: boolean;
  removing?: boolean;
}

export function DashboardAlertRow({
  alert,
  onDismiss,
  dismissing = false,
  removing = false,
}: DashboardAlertRowProps) {
  const isCrisis = alert.type === 'crisis';
  const checkinPath = getAlertCheckinPath(alert);
  const crisisLabel = isCrisis ? getCrisisLevelLabel(alert.crisis_level) : null;

  return (
    <div
      className={`flex items-center gap-2 rounded-xl border border-[#EDE4DC]/45 border-l-[3px] px-2.5 py-2.5 transition-all duration-300 sm:gap-2.5 sm:px-3 ${getAlertRowClassName(alert.type)} ${
        removing ? 'pointer-events-none scale-[0.98] opacity-0' : 'opacity-100'
      }`}
    >
      <span className="shrink-0 text-base leading-none" aria-hidden>
        {getAlertEmoji(alert.type)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-medium leading-tight text-charcoal">
            {alert.patient?.name ?? 'Paciente'}
          </p>
          {isCrisis && crisisLabel ? (
            <span className="inline-flex shrink-0 items-center rounded-full bg-alert/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-alert">
              Crise · {crisisLabel}
            </span>
          ) : null}
        </div>
        <p className={`mt-0.5 truncate text-[11px] leading-snug ${isCrisis ? 'text-amber-950/80' : 'text-charcoal-muted'}`}>
          {getAlertSummary(alert)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {checkinPath ? (
          <Link
            to={checkinPath}
            className={`inline-flex h-8 items-center justify-center rounded-lg border bg-white px-3 text-xs font-semibold transition-colors ${
              isCrisis
                ? 'border-alert/30 text-alert hover:border-alert/45 hover:bg-alert-bg/40'
                : 'border-primary/25 text-primary hover:border-primary/40 hover:bg-primary-50'
            }`}
          >
            Ver
          </Link>
        ) : null}

        <button
          type="button"
          onClick={() => onDismiss(alert.id)}
          disabled={dismissing || removing}
          aria-label={getAlertDismissAriaLabel(alert)}
          title="Marcar este alerta como lido"
          className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:px-2.5 sm:text-xs ${
            isCrisis
              ? 'border-alert/25 bg-white/90 text-alert hover:border-alert/40 hover:bg-alert-bg/50'
              : 'border-slate-200/80 bg-white/90 text-charcoal-muted hover:border-primary/25 hover:bg-primary-50 hover:text-primary'
          }`}
        >
          <DismissIcon />
          <span>Lido</span>
        </button>
      </div>
    </div>
  );
}
