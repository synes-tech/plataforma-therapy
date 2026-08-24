import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarMonthSkeleton, LoadingOverlay } from '@containers/loading';
import { callFunction } from '@shared/lib/api';
import { formatTimeBr, getBrDateISO } from './calendar-week.utils';
import type { RangeSessionsResponse } from './calendar-week.types';
import { WEEKDAYS, buildMonthGrid, groupMonthSessionChips, monthDateRange } from './calendar-month.utils';

const CHIP_TONE: Record<string, string> = {
  scheduled: 'bg-primary-50 text-primary',
  completed: 'bg-emerald-50 text-mint-dark',
  canceled: 'bg-slate-100 text-slate-500 line-through',
  cancelled: 'bg-slate-100 text-slate-500 line-through',
  no_show: 'bg-amber-50 text-amber-800',
};

const VISIBLE_CHIPS = 3;

interface CalendarMonthViewProps {
  year: number;
  month0: number;
  todayISO: string;
  countByDate: Map<string, number>;
  showSkeleton: boolean;
  showRefetchOverlay: boolean;
  onDayClick: (iso: string, event: React.MouseEvent<HTMLButtonElement>) => void;
}

export function CalendarMonthView({
  year,
  month0,
  todayISO,
  countByDate,
  showSkeleton,
  showRefetchOverlay,
  onDayClick,
}: CalendarMonthViewProps) {
  const grid = useMemo(() => buildMonthGrid(year, month0), [year, month0]);
  const range = useMemo(() => monthDateRange(year, month0), [year, month0]);

  const { data: rangeData } = useQuery({
    queryKey: ['range-sessions', range.start, range.end],
    queryFn: () =>
      callFunction<RangeSessionsResponse>('get-daily-sessions', {
        start_date: range.start,
        end_date: range.end,
      }),
    enabled: !showSkeleton,
  });

  const chipsByDate = useMemo(
    () => groupMonthSessionChips(rangeData?.sessions ?? [], getBrDateISO, formatTimeBr),
    [rangeData?.sessions],
  );

  if (showSkeleton) {
    return <CalendarMonthSkeleton />;
  }

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <LoadingOverlay show={showRefetchOverlay} label="Atualizando agenda..." />

      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/70">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-charcoal-muted sm:text-xs"
          >
            <span className="hidden sm:inline">{w}</span>
            <span className="sm:hidden">{w[0]}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {grid.map((cell) => {
          const chips = chipsByDate.get(cell.iso) ?? [];
          const count = chips.length || (countByDate.get(cell.iso) ?? 0);
          const extra = Math.max(0, count - VISIBLE_CHIPS);
          const isToday = cell.iso === todayISO;
          const weekend = new Date(`${cell.iso}T12:00:00`).getDay() % 6 === 0;

          return (
            <button
              key={cell.iso}
              type="button"
              onClick={(event) => {
                if (!cell.inMonth) return;
                onDayClick(cell.iso, event);
              }}
              disabled={!cell.inMonth || showRefetchOverlay}
              className={`flex min-h-[5.75rem] flex-col items-stretch border-b border-r border-slate-100 p-1.5 text-left transition-colors sm:min-h-[6.75rem] lg:min-h-[7.5rem] lg:p-2 ${
                !cell.inMonth
                  ? 'cursor-default bg-slate-50/60'
                  : isToday
                    ? 'bg-primary-50/50 hover:bg-primary-50'
                    : weekend
                      ? 'bg-slate-50/80 hover:bg-slate-50'
                      : 'bg-white hover:bg-slate-50'
              } ${showRefetchOverlay ? 'pointer-events-none' : ''}`}
            >
              <span
                className={`mb-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold sm:text-sm ${
                  !cell.inMonth
                    ? 'text-slate-300'
                    : isToday
                      ? 'bg-primary text-white'
                      : 'text-charcoal'
                }`}
              >
                {cell.day}
              </span>

              {cell.inMonth ? (
                <span className="flex min-h-0 flex-1 flex-col gap-0.5">
                  {chips.slice(0, VISIBLE_CHIPS).map((chip) => (
                    <span
                      key={chip.id}
                      className={`truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight ${
                        CHIP_TONE[chip.status] ?? CHIP_TONE.scheduled
                      }`}
                      title={`${chip.time} · ${chip.name}`}
                    >
                      <span className="hidden sm:inline">{chip.time} </span>
                      {chip.name}
                    </span>
                  ))}
                  {chips.length === 0 && count > 0 ? (
                    <span className="truncate rounded bg-primary-50 px-1 py-0.5 text-[10px] font-medium text-primary">
                      {count} {count === 1 ? 'sessão' : 'sessões'}
                    </span>
                  ) : null}
                  {extra > 0 ? (
                    <span className="px-1 text-[10px] font-medium text-charcoal-muted">+{extra}</span>
                  ) : null}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
