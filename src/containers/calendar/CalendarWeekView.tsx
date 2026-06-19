import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarWeekSkeleton } from '@containers/loading';
import { callFunction } from '@shared/lib/api';
import { CalendarWeekGrid } from './CalendarWeekGrid';
import { getWeekDays, sessionsToLayoutedEvents } from './calendar-week.utils';
import type { RangeSessionsResponse } from './calendar-week.types';

interface CalendarWeekViewProps {
  weekSundayISO: string;
  todayISO: string;
  onDayClick: (dayISO: string) => void;
}

export function CalendarWeekView({ weekSundayISO, todayISO, onDayClick }: CalendarWeekViewProps) {
  const weekDays = useMemo(() => getWeekDays(weekSundayISO), [weekSundayISO]);
  const startDate = weekDays[0]!;
  const endDate = weekDays[6]!;

  const { data, isPending, isFetching, error } = useQuery({
    queryKey: ['range-sessions', startDate, endDate],
    queryFn: () =>
      callFunction<RangeSessionsResponse>('get-daily-sessions', {
        start_date: startDate,
        end_date: endDate,
      }),
  });

  const layoutedEvents = useMemo(
    () => sessionsToLayoutedEvents(data?.sessions ?? []),
    [data?.sessions],
  );

  const showSkeleton = !data && (isPending || isFetching);
  const showRefetchOverlay = !!data && isFetching;

  if (error) {
    return (
      <div className="rounded-2xl border border-error/20 bg-error-light/40 px-4 py-8 text-center text-sm text-error">
        Não foi possível carregar a agenda da semana.
      </div>
    );
  }

  if (showSkeleton) {
    return <CalendarWeekSkeleton weekDays={weekDays} todayISO={todayISO} />;
  }

  return (
    <CalendarWeekGrid
      weekDays={weekDays}
      events={layoutedEvents}
      todayISO={todayISO}
      showRefetchOverlay={showRefetchOverlay}
      onEventClick={onDayClick}
    />
  );
}
