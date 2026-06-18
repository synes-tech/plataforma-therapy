import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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
    <div className="space-y-6">
      <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
      <div className="space-y-3">
        <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}

export function CalendarListView({ todayISO, onNewSchedule }: CalendarListViewProps) {
  const { data, isLoading, error } = useQuery({
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

  if (isLoading) {
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
    <div className="space-y-2">
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
