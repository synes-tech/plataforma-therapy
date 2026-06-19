import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ListPageSkeleton, LoadingOverlay, Spinner } from '@containers/loading';
import { callFunction } from '@shared/lib/api';
import { CalendarListEmptyState } from './CalendarListEmptyState';
import { CalendarListSessionCard } from './CalendarListSessionCard';
import type { ListSessionsResponse } from './calendar-list.types';
import { formatListDayHeader, groupSessionsByDay } from './calendar-list.utils';

interface CalendarListViewProps {
  todayISO: string;
  onNewSchedule: () => void;
}

function ListSkeleton() {
  return (
    <div
      className="relative space-y-6 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
      aria-busy="true"
      role="status"
      aria-label="Carregando agenda em lista"
    >
      <ListPageSkeleton rows={1} rowClassName="h-10" />
      <ListPageSkeleton rows={3} rowClassName="h-16" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-white/60">
        <Spinner size="md" />
        <p className="text-xs font-medium text-charcoal-muted">Carregando agenda...</p>
      </div>
    </div>
  );
}

export function CalendarListView({ todayISO, onNewSchedule }: CalendarListViewProps) {
  const { data, isPending, isFetching, error } = useQuery({
    queryKey: ['list-sessions', todayISO],
    queryFn: () =>
      callFunction<ListSessionsResponse>('get-daily-sessions', {
        view: 'list',
        days_ahead: 30,
      }),
  });

  const dayGroups = useMemo(
    () => groupSessionsByDay(data?.sessions ?? []),
    [data?.sessions],
  );

  const showSkeleton = !data && (isPending || isFetching);
  const showRefetchOverlay = !!data && isFetching;

  if (showSkeleton) {
    return <ListSkeleton />;
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-error/20 bg-error-light/40 px-4 py-8 text-center text-sm text-error">
        Não foi possível carregar sua agenda em lista.
      </div>
    );
  }

  if (dayGroups.length === 0) {
    return <CalendarListEmptyState onNewSchedule={onNewSchedule} />;
  }

  return (
    <div className="relative space-y-2">
      <LoadingOverlay show={showRefetchOverlay} label="Atualizando agenda..." />
      <p className="text-xs font-medium uppercase tracking-wider text-charcoal-muted/70">
        Próximos 30 dias · {data?.sessions.length ?? 0} atendimento
        {(data?.sessions.length ?? 0) === 1 ? '' : 's'}
      </p>

      <div className="space-y-6">
        {dayGroups.map((group) => (
          <section key={group.dateISO} aria-labelledby={`list-day-${group.dateISO}`}>
            <header
              id={`list-day-${group.dateISO}`}
              className="sticky top-0 z-10 -mx-1 mb-3 border-b border-slate-200/60 bg-gray-50/80 px-1 py-2.5 backdrop-blur-md"
            >
              <h2 className="font-display text-sm font-semibold text-charcoal">
                {formatListDayHeader(group.dateISO, todayISO)}
              </h2>
            </header>

            <ul className="space-y-2">
              {group.sessions.map((session) => (
                <li key={session.id}>
                  <CalendarListSessionCard session={session} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
