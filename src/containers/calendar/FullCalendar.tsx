import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { NewScheduleModal } from '@features/calendar/NewScheduleModal';
import { CalendarHeaderBar } from './CalendarHeaderBar';
import { CalendarMonthView } from './CalendarMonthView';
import { CalendarListView } from './CalendarListView';
import { CalendarWeekView } from './CalendarWeekView';
import { CalendarDayActionPopover } from './CalendarDayActionPopover';
import { CalendarDayPatientsDrawer } from './CalendarDayPatientsDrawer';
import { brTodayISO } from './calendar-month.utils';
import { rectToAnchor } from './calendar-day-action.types';
import type { DayActionMenuState } from './calendar-day-action.types';
import {
  formatWeekRangeLabel,
  getWeekSunday,
  shiftWeek,
} from './calendar-week.utils';
import type { CalendarView, MonthlySummary } from './calendar-view.types';

export default function FullCalendar() {
  const queryClient = useQueryClient();
  const todayISO = brTodayISO();
  const todayParts = todayISO.split('-');
  const todayY = Number(todayParts[0]);
  const todayM = Number(todayParts[1]);

  const [currentView, setCurrentView] = useState<CalendarView>('month');
  const [cursor, setCursor] = useState({ year: todayY, month0: todayM - 1 });
  const [weekSundayISO, setWeekSundayISO] = useState(() => getWeekSunday(todayISO));
  const [dayActionMenu, setDayActionMenu] = useState<DayActionMenuState | null>(null);
  const [drawerDate, setDrawerDate] = useState<string | null>(null);
  const [newScheduleOpen, setNewScheduleOpen] = useState(false);
  const [newScheduleDate, setNewScheduleDate] = useState(todayISO);

  const weekLabel = useMemo(() => formatWeekRangeLabel(weekSundayISO), [weekSundayISO]);

  const { data, isPending, isFetching } = useQuery({
    queryKey: ['monthly-summary', cursor.year, cursor.month0],
    queryFn: () =>
      callFunction<MonthlySummary>('get-monthly-summary', {
        year: cursor.year,
        month: cursor.month0 + 1,
      }),
    enabled: currentView === 'month',
  });

  const showMonthSkeleton = !data && (isPending || isFetching);
  const showMonthRefetch = !!data && isFetching;

  const countByDate = useMemo(() => {
    const m = new Map<string, number>();
    (data?.days ?? []).forEach((d) => m.set(d.date, d.total_sessions));
    return m;
  }, [data]);

  function goPrev() {
    if (currentView === 'week') {
      setWeekSundayISO((w) => shiftWeek(w, -1));
      return;
    }
    setCursor((c) => (c.month0 === 0 ? { year: c.year - 1, month0: 11 } : { year: c.year, month0: c.month0 - 1 }));
  }

  function goNext() {
    if (currentView === 'week') {
      setWeekSundayISO((w) => shiftWeek(w, 1));
      return;
    }
    setCursor((c) => (c.month0 === 11 ? { year: c.year + 1, month0: 0 } : { year: c.year, month0: c.month0 + 1 }));
  }

  function goToday() {
    setCursor({ year: todayY, month0: todayM - 1 });
    setWeekSundayISO(getWeekSunday(todayISO));
  }

  function openNewSchedule(date: string) {
    setNewScheduleDate(date);
    setNewScheduleOpen(true);
  }

  function handleViewChange(view: CalendarView) {
    setCurrentView(view);
    if (view === 'week') {
      setWeekSundayISO(getWeekSunday(todayISO));
    }
  }

  function handleMonthDayClick(iso: string, event: React.MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    setDayActionMenu({ dateISO: iso, anchor: rectToAnchor(rect) });
  }

  function openDayDrawer(dayISO: string) {
    setDrawerDate(dayISO);
  }

  function invalidateAgenda() {
    void queryClient.invalidateQueries({ queryKey: ['monthly-summary'] });
    void queryClient.invalidateQueries({ queryKey: ['range-sessions'] });
    void queryClient.invalidateQueries({ queryKey: ['daily-sessions'] });
    void queryClient.invalidateQueries({ queryKey: ['list-sessions'] });
  }

  return (
    <div className="bg-[#F8FAF9] px-4 sm:px-6 lg:px-8">
      <CalendarHeaderBar
        currentView={currentView}
        onViewChange={handleViewChange}
        year={cursor.year}
        month0={cursor.month0}
        weekLabel={weekLabel}
        onPrev={goPrev}
        onNext={goNext}
        onToday={goToday}
        onNewSchedule={() => openNewSchedule(todayISO)}
      />

      <div className="mt-6 lg:mt-8">
        {currentView === 'month' && (
          <CalendarMonthView
            year={cursor.year}
            month0={cursor.month0}
            todayISO={todayISO}
            countByDate={countByDate}
            showSkeleton={showMonthSkeleton}
            showRefetchOverlay={showMonthRefetch}
            onDayClick={handleMonthDayClick}
          />
        )}

        {currentView === 'week' && (
          <CalendarWeekView
            weekSundayISO={weekSundayISO}
            todayISO={todayISO}
            onDayClick={openDayDrawer}
          />
        )}

        {currentView === 'list' && (
          <CalendarListView todayISO={todayISO} onNewSchedule={() => openNewSchedule(todayISO)} />
        )}
      </div>

      <CalendarDayActionPopover
        menu={dayActionMenu}
        onClose={() => setDayActionMenu(null)}
        onViewPatients={openDayDrawer}
        onNewSchedule={openNewSchedule}
      />

      <CalendarDayPatientsDrawer
        dateISO={drawerDate}
        onClose={() => setDrawerDate(null)}
        onNewSchedule={openNewSchedule}
        onRescheduled={invalidateAgenda}
      />

      <NewScheduleModal
        isOpen={newScheduleOpen}
        onClose={() => setNewScheduleOpen(false)}
        defaultDate={newScheduleDate}
      />
    </div>
  );
}
