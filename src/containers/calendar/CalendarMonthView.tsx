import { useMemo } from 'react';
import { CalendarMonthSkeleton, LoadingOverlay } from '@containers/loading';
import { WEEKDAYS, buildMonthGrid } from './calendar-month.utils';

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

  if (showSkeleton) {
    return <CalendarMonthSkeleton />;
  }

  return (
    <div className="relative w-full rounded-2xl border border-slate-100 bg-white p-4 shadow-sm md:p-4">
      <LoadingOverlay show={showRefetchOverlay} label="Atualizando agenda..." />

      <div className="grid grid-cols-7 gap-1.5 md:gap-1">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="pb-1 text-center text-xs font-semibold uppercase tracking-wider text-charcoal-muted/70 md:pb-1 md:text-sm"
          >
            <span className="hidden sm:inline">{w}</span>
            <span className="sm:hidden">{w[0]}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5 md:gap-1">
        {grid.map((cell) => {
          const count = countByDate.get(cell.iso) ?? 0;
          const isToday = cell.iso === todayISO;

          return (
            <button
              key={cell.iso}
              type="button"
              onClick={(event) => {
                if (!cell.inMonth) return;
                onDayClick(cell.iso, event);
              }}
              disabled={!cell.inMonth || showRefetchOverlay}
              className={`flex min-h-[72px] w-full flex-col rounded-xl border p-2 text-left transition-colors md:h-16 md:min-h-0 md:rounded-lg md:p-2 lg:h-[4.5rem] ${
                !cell.inMonth
                  ? 'cursor-default border-transparent bg-transparent'
                  : isToday
                    ? 'border-blue-400 bg-blue-50/50 hover:border-blue-500'
                    : 'border-slate-100 bg-white shadow-sm hover:border-blue-200 md:shadow-none'
              } ${showRefetchOverlay ? 'pointer-events-none' : ''}`}
            >
              <span
                className={`text-sm leading-none sm:text-base md:text-base lg:text-lg ${
                  !cell.inMonth
                    ? 'text-transparent'
                    : isToday
                      ? 'font-bold text-blue-700'
                      : 'font-semibold text-charcoal'
                }`}
              >
                {cell.day}
              </span>

              {cell.inMonth && count > 0 && (
                <span
                  className="mt-auto truncate rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium leading-tight text-blue-700 md:px-1.5 md:py-0.5 md:text-xs"
                  title={`${count} ${count === 1 ? 'sessão' : 'sessões'}`}
                >
                  <span className="md:hidden">
                    {count} {count === 1 ? 'sessão' : 'sessões'}
                  </span>
                  <span className="hidden md:inline">
                    {count} sess.
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
