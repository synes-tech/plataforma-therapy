import { useMemo } from 'react';
import { LoadingOverlay } from '@containers/loading';
import { CalendarWeekEventBlock } from './CalendarWeekEventBlock';
import type { LayoutedWeekEvent } from './calendar-week.types';
import {
  buildHourMarkers,
  formatDayHeader,
  getNowIndicatorTopPx,
  weekGridHeightPx,
} from './calendar-week.utils';
import { WEEK_HOUR_HEIGHT_PX } from './calendar-week.types';

interface CalendarWeekGridProps {
  weekDays: string[];
  events: LayoutedWeekEvent[];
  todayISO: string;
  showRefetchOverlay?: boolean;
  onEventClick?: (dayISO: string) => void;
}

export function CalendarWeekGrid({
  weekDays,
  events,
  todayISO,
  showRefetchOverlay = false,
  onEventClick,
}: CalendarWeekGridProps) {
  const gridHeight = weekGridHeightPx();
  const hours = buildHourMarkers();
  const nowTop = getNowIndicatorTopPx();

  const eventsByDay = useMemo(() => {
    const map = new Map<string, LayoutedWeekEvent[]>();
    weekDays.forEach((d) => map.set(d, []));
    events.forEach((e) => {
      const list = map.get(e.dayISO) ?? [];
      list.push(e);
      map.set(e.dayISO, list);
    });
    return map;
  }, [events, weekDays]);

  return (
    <div className="relative rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <LoadingOverlay show={showRefetchOverlay} label="Atualizando agenda..." />
      {/* Cabeçalho dos dias — scroll horizontal no mobile */}
      <div className="overflow-x-auto border-b border-slate-100 scrollbar-hide">
        <div className="flex min-w-[640px] md:min-w-0">
          <div className="w-14 shrink-0 md:w-16" />
          {weekDays.map((dayISO) => {
            const { weekday, day, isToday } = formatDayHeader(dayISO, todayISO);
            return (
              <div
                key={dayISO}
                className="min-w-[calc(100vw-4rem)] flex-1 snap-center border-l border-slate-100 px-2 py-3 text-center md:min-w-0"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-charcoal-muted">
                  {weekday}
                </p>
                <p
                  className={`mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                    isToday ? 'bg-primary text-white' : 'text-charcoal'
                  }`}
                >
                  {day}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid com scroll vertical */}
      <div className="max-h-[70vh] overflow-y-auto overflow-x-auto">
        <div className="flex min-w-[640px] md:min-w-0">
          {/* Coluna de horas */}
          <div className="relative w-14 shrink-0 md:w-16" style={{ height: gridHeight }}>
            {hours.slice(0, -1).map((hour) => (
              <div
                key={hour}
                className="absolute right-2 -translate-y-1/2 text-[10px] font-medium text-charcoal-muted md:text-xs"
                style={{ top: (hour - 7) * WEEK_HOUR_HEIGHT_PX }}
              >
                {String(hour).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Colunas dos dias */}
          <div className="flex flex-1 snap-x snap-mandatory overflow-x-auto md:overflow-visible">
            {weekDays.map((dayISO) => {
              const isToday = dayISO === todayISO;
              const dayEvents = eventsByDay.get(dayISO) ?? [];

              return (
                <div
                  key={dayISO}
                  className="relative min-w-[calc(100vw-4rem)] flex-1 snap-center border-l border-slate-100 md:min-w-0"
                  style={{ height: gridHeight }}
                >
                  {hours.slice(0, -1).map((hour) => (
                    <div
                      key={hour}
                      className="absolute inset-x-0 border-t border-slate-100"
                      style={{ top: (hour - 7) * WEEK_HOUR_HEIGHT_PX }}
                    />
                  ))}

                  {isToday && nowTop !== null && (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
                      style={{ top: nowTop }}
                    >
                      <span className="-ml-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />
                      <span className="h-0.5 flex-1 bg-red-500" />
                    </div>
                  )}

                  {dayEvents.map((event) => (
                    <CalendarWeekEventBlock
                      key={event.id}
                      event={event}
                      onClick={() => onEventClick?.(dayISO)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
