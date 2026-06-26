import { useMemo } from 'react';
import { LoadingOverlay } from '@containers/loading';
import { CalendarWeekEventBlock } from './CalendarWeekEventBlock';
import type { LayoutedWeekEvent, WeekSlotClickPayload } from './calendar-week.types';
import {
  buildHourMarkers,
  formatDayHeader,
  getNowIndicatorTopPx,
  getTimeFromHourSlotClick,
  weekGridHeightPx,
} from './calendar-week.utils';
import { WEEK_HOUR_HEIGHT_PX, WEEK_HOUR_START } from './calendar-week.types';

interface CalendarWeekGridProps {
  weekDays: string[];
  events: LayoutedWeekEvent[];
  todayISO: string;
  showRefetchOverlay?: boolean;
  onEventClick?: (dayISO: string) => void;
  onSlotClick?: (payload: WeekSlotClickPayload) => void;
}

export function CalendarWeekGrid({
  weekDays,
  events,
  todayISO,
  showRefetchOverlay = false,
  onEventClick,
  onSlotClick,
}: CalendarWeekGridProps) {
  const gridHeight = weekGridHeightPx();
  const hours = buildHourMarkers();

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

      <div className="max-h-[70vh] overflow-y-auto overflow-x-auto">
        <div className="flex min-w-[640px] md:min-w-0">
          <div className="relative w-14 shrink-0 md:w-16" style={{ height: gridHeight }}>
            {hours.slice(0, -1).map((hour) => (
              <div
                key={hour}
                className="absolute right-2 -translate-y-1/2 text-[10px] font-medium text-charcoal-muted md:text-xs"
                style={{ top: (hour - WEEK_HOUR_START) * WEEK_HOUR_HEIGHT_PX }}
              >
                {String(hour).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          <div className="flex flex-1 snap-x snap-mandatory overflow-x-auto md:overflow-visible">
            {weekDays.map((dayISO) => {
              const isToday = dayISO === todayISO;
              const dayEvents = eventsByDay.get(dayISO) ?? [];
              const dayHeader = formatDayHeader(dayISO, todayISO);

              return (
                <div
                  key={dayISO}
                  className="relative min-w-[calc(100vw-4rem)] flex-1 snap-center border-l border-slate-100 md:min-w-0"
                  style={{ height: gridHeight }}
                >
                  {onSlotClick &&
                    hours.slice(0, -1).map((hour) => (
                      <button
                        key={`${dayISO}-${hour}`}
                        type="button"
                        className="absolute inset-x-0 z-[1] cursor-pointer border-0 bg-transparent transition-colors hover:bg-primary/[0.06] focus-visible:z-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35"
                        style={{
                          top: (hour - WEEK_HOUR_START) * WEEK_HOUR_HEIGHT_PX,
                          height: WEEK_HOUR_HEIGHT_PX,
                        }}
                        aria-label={`Novo agendamento — ${dayHeader.weekday}, ${String(hour).padStart(2, '0')}:00`}
                        onClick={(event) => {
                          const rect = event.currentTarget.getBoundingClientRect();
                          const offsetInHour = event.clientY - rect.top;
                          onSlotClick({
                            dayISO,
                            time: getTimeFromHourSlotClick(hour, offsetInHour),
                          });
                        }}
                      />
                    ))}

                  {hours.slice(0, -1).map((hour) => (
                    <div
                      key={`line-${dayISO}-${hour}`}
                      className="pointer-events-none absolute inset-x-0 border-t border-slate-100"
                      style={{ top: (hour - WEEK_HOUR_START) * WEEK_HOUR_HEIGHT_PX }}
                    />
                  ))}

                  {isToday && getNowIndicatorTopPx() !== null && (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
                      style={{ top: getNowIndicatorTopPx()! }}
                    >
                      <span className="-ml-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />
                      <span className="h-0.5 flex-1 bg-red-500" />
                    </div>
                  )}

                  {dayEvents.map((event) => (
                    <CalendarWeekEventBlock
                      key={event.id}
                      event={event}
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        onEventClick?.(dayISO);
                      }}
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
