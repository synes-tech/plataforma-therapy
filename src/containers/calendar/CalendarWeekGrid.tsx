import { useEffect, useMemo, useRef } from 'react';
import { LoadingOverlay } from '@containers/loading';
import { CalendarWeekEventBlock } from './CalendarWeekEventBlock';
import type { LayoutedWeekEvent, WeekSlotClickPayload } from './calendar-week.types';
import {
  buildHourMarkers,
  formatDayHeader,
  getNowIndicatorTopPx,
  getTimeFromHourSlotClick,
  isWeekFocusHour,
  weekFocusScrollTopPx,
  weekFocusViewportHeightPx,
  weekGridHeightPx,
} from './calendar-week.utils';
import {
  WEEK_FOCUS_HOUR_END,
  WEEK_FOCUS_HOUR_START,
  WEEK_HOUR_HEIGHT_PX,
  WEEK_HOUR_START,
} from './calendar-week.types';

const WEEK_GRID_COLS = 'grid-cols-[2.75rem_repeat(7,minmax(0,1fr))] sm:grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]';

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
  const focusHeight = weekFocusViewportHeightPx();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number | null;
    startY: number;
    startScroll: number;
    dragged: boolean;
  }>({ pointerId: null, startY: 0, startScroll: 0, dragged: false });

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

  useEffect(() => {
    if (!scrollerRef.current) return;
    scrollerRef.current.scrollTop = weekFocusScrollTopPx();
  }, [weekDays[0]]);

  function beginDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !scrollerRef.current) return;
    if ((event.target as HTMLElement).closest('[data-week-event]')) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startScroll: scrollerRef.current.scrollTop,
      dragged: false,
    };
  }

  function moveDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId || !scrollerRef.current) return;
    const delta = event.clientY - drag.startY;
    if (!drag.dragged && Math.abs(delta) < 6) return;
    if (!drag.dragged) {
      drag.dragged = true;
      scrollerRef.current.setPointerCapture(event.pointerId);
    }
    scrollerRef.current.scrollTop = drag.startScroll - delta;
    event.preventDefault();
  }

  function endDrag() {
    dragRef.current.pointerId = null;
  }

  function wasDragScroll(): boolean {
    if (!dragRef.current.dragged) return false;
    dragRef.current.dragged = false;
    return true;
  }

  return (
    <div className="relative flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <LoadingOverlay show={showRefetchOverlay} label="Atualizando agenda..." />

      <div className={`grid shrink-0 border-b border-slate-200 bg-white ${WEEK_GRID_COLS}`}>
        <div aria-hidden />
        {weekDays.map((dayISO) => {
          const { weekday, day, isToday } = formatDayHeader(dayISO, todayISO);
          const weekend = new Date(`${dayISO}T12:00:00`).getDay() % 6 === 0;
          return (
            <button
              key={dayISO}
              type="button"
              onClick={() => onEventClick?.(dayISO)}
              className={`border-l border-slate-100 px-0.5 py-1.5 text-center transition-colors hover:bg-slate-50 ${
                isToday ? 'bg-primary-50/70' : weekend ? 'bg-slate-50/80' : ''
              }`}
            >
              <p className="flex items-center justify-center gap-1 text-[11px] leading-none sm:gap-1.5 sm:text-xs">
                <span className="font-semibold uppercase tracking-wide text-charcoal-muted">{weekday}</span>
                <span
                  className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-semibold tabular-nums ${
                    isToday ? 'bg-primary text-white' : 'text-charcoal'
                  }`}
                >
                  {day}
                </span>
              </p>
            </button>
          );
        })}
      </div>

      <div
        ref={scrollerRef}
        className="min-h-0 cursor-grab overflow-x-hidden overflow-y-auto overscroll-contain select-none active:cursor-grabbing"
        style={{ height: `min(${focusHeight}px, calc(100dvh - 16rem))` }}
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className={`grid w-full ${WEEK_GRID_COLS}`} style={{ height: gridHeight }}>
          <div className="relative">
            {hours.slice(0, -1).map((hour) => (
              <div
                key={hour}
                className={`absolute right-1.5 text-[10px] font-medium tabular-nums sm:right-2 sm:text-[11px] ${
                  hour === WEEK_HOUR_START ? 'translate-y-0.5' : '-translate-y-1/2'
                } ${isWeekFocusHour(hour) || hour === WEEK_FOCUS_HOUR_END ? 'text-charcoal' : 'text-charcoal-muted/55'}`}
                style={{ top: (hour - WEEK_HOUR_START) * WEEK_HOUR_HEIGHT_PX }}
              >
                {String(hour).padStart(2, '0')}
              </div>
            ))}
          </div>

          {weekDays.map((dayISO) => {
            const isToday = dayISO === todayISO;
            const weekend = new Date(`${dayISO}T12:00:00`).getDay() % 6 === 0;
            const dayEvents = eventsByDay.get(dayISO) ?? [];
            const dayHeader = formatDayHeader(dayISO, todayISO);

            return (
              <div
                key={dayISO}
                className={`relative border-l border-slate-100 ${
                  isToday ? 'bg-primary-50/40' : weekend ? 'bg-slate-50/70' : 'bg-white'
                }`}
              >
                <div
                  className="pointer-events-none absolute inset-x-0 z-0 bg-slate-100/80"
                  style={{
                    top: 0,
                    height: (WEEK_FOCUS_HOUR_START - WEEK_HOUR_START) * WEEK_HOUR_HEIGHT_PX,
                  }}
                />
                <div
                  className="pointer-events-none absolute inset-x-0 z-0 bg-slate-100/80"
                  style={{
                    top: (WEEK_FOCUS_HOUR_END - WEEK_HOUR_START) * WEEK_HOUR_HEIGHT_PX,
                    height: (24 - WEEK_FOCUS_HOUR_END) * WEEK_HOUR_HEIGHT_PX,
                  }}
                />
                {onSlotClick &&
                  hours.slice(0, -1).map((hour) => (
                    <button
                      key={`${dayISO}-${hour}`}
                      type="button"
                      className="absolute inset-x-0 z-[1] cursor-grab border-0 bg-transparent transition-colors hover:bg-primary/[0.05] focus-visible:z-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/35"
                      style={{
                        top: (hour - WEEK_HOUR_START) * WEEK_HOUR_HEIGHT_PX,
                        height: WEEK_HOUR_HEIGHT_PX,
                      }}
                      aria-label={`Novo agendamento — ${dayHeader.weekday}, ${String(hour).padStart(2, '0')}:00`}
                      onClick={() => {
                        if (wasDragScroll()) return;
                        onSlotClick({
                          dayISO,
                          time: getTimeFromHourSlotClick(hour),
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
                    <span className="-ml-1 h-2 w-2 shrink-0 rounded-full bg-error" />
                    <span className="h-px flex-1 bg-error" />
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
  );
}
