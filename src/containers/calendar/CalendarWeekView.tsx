import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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

  const { data, isLoading, error } = useQuery({
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

  if (error) {
    return (
      <div className="rounded-2xl border border-error/20 bg-error-light/40 px-4 py-8 text-center text-sm text-error">
        Não foi possível carregar a agenda da semana.
      </div>
    );
  }

  return (
    <CalendarWeekGrid
      weekDays={weekDays}
      events={layoutedEvents}
      todayISO={todayISO}
      isLoading={isLoading}
      onEventClick={onDayClick}
    />
  );
}
