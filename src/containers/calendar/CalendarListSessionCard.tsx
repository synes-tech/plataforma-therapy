import { Link } from 'react-router-dom';
import type { ListSession } from './calendar-list.types';
import {
  formatDuration,
  formatListTime,
  getListStatusStyle,
  getSessionTypeLabel,
} from './calendar-list.utils';

interface CalendarListSessionCardProps {
  session: ListSession;
}

export function CalendarListSessionCard({ session }: CalendarListSessionCardProps) {
  const name = session.patient?.name ?? session.title ?? 'Sessão';
  const status = getListStatusStyle(session.status);
  const typeLabel = getSessionTypeLabel(session.title);
  const patientId = session.patient?.id;

  return (
    <article
      className={`flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-3 shadow-sm transition-shadow hover:shadow-md sm:gap-4 sm:px-4 ${status.borderClass} border-l-4`}
    >
      <div className="flex w-[4.5rem] shrink-0 flex-col sm:w-20">
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 shrink-0 rounded-full ${status.dotClass}`} aria-hidden />
          <time className="font-mono text-sm font-bold text-gray-900" dateTime={session.scheduled_at}>
            {formatListTime(session.scheduled_at)}
          </time>
        </div>
        <span className="mt-0.5 pl-3.5 text-xs text-gray-500">{formatDuration(session.duration_minutes)}</span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-charcoal">{name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-charcoal-muted">
            {typeLabel}
          </span>
          <span className="text-[11px] text-charcoal-muted/70">{status.label}</span>
        </div>
      </div>

      {patientId ? (
        <Link
          to={`/patients/${patientId}/copilot`}
          aria-label={`Abrir prontuário de ${name}`}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-charcoal-muted transition-colors hover:bg-slate-50 hover:text-primary"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
        </Link>
      ) : (
        <span className="h-10 w-10 shrink-0" aria-hidden />
      )}
    </article>
  );
}
