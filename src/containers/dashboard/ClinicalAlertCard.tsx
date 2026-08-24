import { Link } from 'react-router-dom';
import { PatientAvatar } from '@containers/patient/PatientAvatar';
import type { ClinicalAlertItem } from './clinical-alerts.types';
import {
  clinicalAlertSeverityLabel,
  clinicalAlertSourceLabel,
  clinicalRecordPath,
  formatAlertOccurredAt,
} from './clinical-alerts.utils';

interface ClinicalAlertCardProps {
  alert: ClinicalAlertItem;
  onAcknowledge: (alertId: string) => void;
  acknowledging?: boolean;
  removing?: boolean;
}

function SirenIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  );
}

function AttentionIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export function ClinicalAlertCard({
  alert,
  onAcknowledge,
  acknowledging = false,
  removing = false,
}: ClinicalAlertCardProps) {
  const severe = alert.severity === 'SEVERE';

  return (
    <article
      className={`rounded-2xl border bg-white p-4 shadow-sm transition-all duration-300 ${
        severe
          ? 'border-error/40 ring-1 ring-error/15'
          : 'border-alert/40 ring-1 ring-alert/10'
      } ${removing ? 'pointer-events-none -translate-y-1 scale-[0.98] opacity-0' : 'opacity-100'}`}
    >
      <div className="flex items-start gap-3">
        <PatientAvatar name={alert.patient_name} fotoUrl={alert.patient_foto_url} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-display text-sm font-semibold text-charcoal">{alert.patient_name}</h3>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                severe ? 'bg-error/10 text-error' : 'bg-alert/15 text-amber-800'
              }`}
            >
              {severe ? <SirenIcon /> : <AttentionIcon />}
              {clinicalAlertSeverityLabel(alert.severity)}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-charcoal-muted">
              {clinicalAlertSourceLabel(alert.source)}
            </span>
            <span className="text-[11px] text-charcoal-muted">{formatAlertOccurredAt(alert.occurred_at)}</span>
          </div>
          <p className={`mt-2 text-sm leading-relaxed text-charcoal ${severe ? 'font-semibold' : ''}`}>
            {alert.summary}
          </p>
          <p className="mt-1 text-xs font-medium text-charcoal-muted">{alert.title}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link
          to={clinicalRecordPath(alert.patient_id)}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-charcoal transition-colors hover:bg-slate-50"
        >
          Abrir prontuário
        </Link>
        <button
          type="button"
          onClick={() => onAcknowledge(alert.id)}
          disabled={acknowledging || removing}
          className={`inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-sm font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-60 ${
            severe ? 'bg-error hover:bg-error/90' : 'bg-alert hover:bg-alert/90'
          }`}
        >
          {acknowledging ? 'Arquivando…' : 'Marcar como visto e arquivar'}
        </button>
      </div>
    </article>
  );
}
