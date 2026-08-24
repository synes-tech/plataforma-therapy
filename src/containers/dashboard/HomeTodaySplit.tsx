import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { PatientAvatar } from '@containers/patient/PatientAvatar';
import { sessionWorkspacePath } from '@containers/session-workspace/session-workspace.utils';
import type { ScheduleItem } from './dashboard.types';
import type { ClinicalAlertItem } from './clinical-alerts.types';
import {
  clinicalAlertSeverityLabel,
  clinicalRecordPath,
  formatAlertOccurredAt,
} from './clinical-alerts.utils';
import { formatScheduleTime } from './dashboard.time';
import {
  HOME_AGENDA_EMPTY,
  HOME_ATTENTION_EMPTY,
  HOME_SPLIT_LIST_PX,
} from './home-layout.utils';
import { sessionPhase } from './home.utils';

const PHASE_LABEL = {
  now: 'Agora',
  upcoming: 'A seguir',
  done: 'Concluída',
  missed: 'Cancelada',
} as const;

interface HomeTodaySplitProps {
  schedule: ScheduleItem[];
  alerts: ClinicalAlertItem[];
  alertsError?: boolean;
  loading?: boolean;
  onAcknowledge: (alertId: string) => void;
  acknowledgingId?: string | null;
  removingIds: ReadonlySet<string>;
}

export function HomeTodaySplit({
  schedule,
  alerts,
  alertsError,
  loading,
  onAcknowledge,
  acknowledgingId,
  removingIds,
}: HomeTodaySplitProps) {
  return (
    <section className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
      <ListCard
        title="Agenda de hoje"
        titleId="home-agenda-title"
        action={
          <Link to="/calendar" className="text-xs font-medium text-primary hover:text-primary-dark">
            Ver agenda
          </Link>
        }
      >
        {loading ? (
          <p className="px-4 py-8 text-center text-sm text-charcoal-muted">Carregando agenda…</p>
        ) : schedule.length === 0 ? (
          <EmptyMessage message={HOME_AGENDA_EMPTY} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {schedule.map((item) => (
              <AgendaRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </ListCard>

      <ListCard
        title="Precisam de atenção"
        titleId="home-attention-title"
        action={
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-display text-[11px] font-bold tabular-nums tracking-tight text-charcoal">
            {alerts.length}
          </span>
        }
      >
        {alertsError ? (
          <p role="alert" className="px-4 py-8 text-center text-sm text-error">
            Não foi possível carregar os alertas.
          </p>
        ) : alerts.length === 0 ? (
          <EmptyMessage message={HOME_ATTENTION_EMPTY} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {alerts.map((alert) => (
              <AttentionRow
                key={alert.id}
                alert={alert}
                onAcknowledge={onAcknowledge}
                acknowledging={acknowledgingId === alert.id}
                removing={removingIds.has(alert.id)}
              />
            ))}
          </ul>
        )}
      </ListCard>
    </section>
  );
}

function ListCard({
  title,
  titleId,
  action,
  children,
}: {
  title: string;
  titleId: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4">
        <h2 id={titleId} className="font-display text-sm font-semibold text-charcoal">
          {title}
        </h2>
        {action}
      </header>
      <div className="min-h-0 overflow-y-auto" style={{ height: HOME_SPLIT_LIST_PX }} role="region" aria-labelledby={titleId}>
        {children}
      </div>
    </article>
  );
}

function EmptyMessage({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center px-6 text-center">
      <p className="max-w-xs text-sm text-charcoal-muted">{message}</p>
    </div>
  );
}

function AgendaRow({ item }: { item: ScheduleItem }) {
  const name = item.patient?.name ?? item.title ?? 'Sessão';
  const phase = sessionPhase(item);
  const isNow = phase === 'now';

  return (
    <li className={`flex min-h-[88px] items-center gap-3 px-4 py-3 ${isNow ? 'bg-primary-50/70' : ''}`}>
      <div className="w-12 shrink-0 text-right">
        <p className="font-display text-sm font-bold tabular-nums tracking-tight text-charcoal">
          {formatScheduleTime(item.scheduled_at)}
        </p>
        {item.duration_minutes ? (
          <p className="font-display text-[11px] font-bold tabular-nums tracking-tight text-charcoal-muted">
            {item.duration_minutes}min
          </p>
        ) : null}
      </div>
      <PatientAvatar name={name} fotoUrl={item.patient?.foto_url} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-charcoal">{name}</p>
        <p className="text-xs text-charcoal-muted">
          <span className={isNow ? 'font-semibold text-primary' : ''}>{PHASE_LABEL[phase]}</span>
        </p>
      </div>
      {item.patient ? (
        <Link
          to={sessionWorkspacePath(item.patient.id, item.id)}
          className="inline-flex h-9 shrink-0 items-center rounded-lg bg-charcoal px-3 text-xs font-medium text-white hover:bg-charcoal-light"
        >
          Iniciar
        </Link>
      ) : null}
    </li>
  );
}

function AttentionRow({
  alert,
  onAcknowledge,
  acknowledging,
  removing,
}: {
  alert: ClinicalAlertItem;
  onAcknowledge: (alertId: string) => void;
  acknowledging?: boolean;
  removing?: boolean;
}) {
  const severe = alert.severity === 'SEVERE';

  return (
    <li
      className={`flex min-h-[88px] items-center gap-3 px-4 py-3 ${
        removing ? 'pointer-events-none opacity-0' : ''
      }`}
    >
      <PatientAvatar name={alert.patient_name} fotoUrl={alert.patient_foto_url} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <p className="truncate text-sm font-medium text-charcoal">{alert.patient_name}</p>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              severe ? 'bg-error/10 text-error' : 'bg-alert/15 text-amber-800'
            }`}
          >
            {clinicalAlertSeverityLabel(alert.severity)}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-charcoal-muted">
          {alert.summary} · {formatAlertOccurredAt(alert.occurred_at)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Link
          to={clinicalRecordPath(alert.patient_id)}
          className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 px-2.5 text-[11px] font-medium text-charcoal hover:border-primary/30 hover:text-primary"
        >
          Ver
        </Link>
        <button
          type="button"
          onClick={() => onAcknowledge(alert.id)}
          disabled={acknowledging || removing}
          className="inline-flex h-9 items-center justify-center rounded-lg bg-slate-100 px-2.5 text-[11px] font-medium text-charcoal hover:bg-slate-200 disabled:opacity-60"
        >
          {acknowledging ? '…' : 'Arquivar'}
        </button>
      </div>
    </li>
  );
}
