import {
  THERAPY_STATUS_LABELS,
  type ScheduledTherapySession,
} from './therapy-calendar.types';
import { formatTherapyTimeRange } from './therapy-calendar.utils';

interface TherapyDaySessionCardProps {
  session: ScheduledTherapySession;
}

export function TherapyDaySessionCard({ session }: TherapyDaySessionCardProps) {
  const statusLabel = THERAPY_STATUS_LABELS[session.status] ?? session.status;
  const timeRange = formatTherapyTimeRange(session.time, session.duration_minutes);

  return (
    <article className="min-w-0 rounded-xl border border-primary/15 bg-gradient-to-br from-primary-50/60 to-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-lg font-semibold text-primary">{session.time}</p>
          <p className="text-xs text-charcoal-muted">{timeRange}</p>
        </div>
        <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
          {statusLabel}
        </span>
      </div>

      <div className="mt-3 space-y-1">
        <p className="break-words text-sm font-medium text-charcoal">
          {session.title?.trim() || 'Sessão de terapia'}
        </p>
        <p className="break-words text-sm text-charcoal-muted">
          Com <span className="font-medium text-charcoal">{session.therapist_name}</span>
        </p>
      </div>
    </article>
  );
}
