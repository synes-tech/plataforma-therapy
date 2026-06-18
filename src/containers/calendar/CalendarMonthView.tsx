import { useMemo } from 'react';
import { WEEKDAYS, buildMonthGrid } from './calendar-month.utils';

interface CalendarMonthViewProps {
  year: number;
  month0: number;
  todayISO: string;
  countByDate: Map<string, number>;
  isLoading: boolean;
  onDayClick: (iso: string, event: React.MouseEvent<HTMLButtonElement>) => void;
}

export function CalendarMonthView({
  year,
  month0,
  todayISO,
  countByDate,
  isLoading,
  onDayClick,
}: CalendarMonthViewProps) {
  const grid = useMemo(() => buildMonthGrid(year, month0), [year, month0]);

  return (
    <>
      <div className="grid grid-cols-7 gap-1.5 md:gap-2">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wider text-charcoal-muted/70"
          >
            <span className="hidden sm:inline">{w}</span>
            <span className="sm:hidden">{w[0]}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5 md:gap-2">
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
              disabled={!cell.inMonth}
              className={`flex min-h-[72px] flex-col rounded-xl border p-1.5 text-left transition-colors md:min-h-[120px] md:p-2 ${
                !cell.inMonth
                  ? 'cursor-default border-transparent bg-transparent'
                  : isToday
                    ? 'border-blue-400 bg-blue-50/50 hover:border-blue-500'
                    : 'border-slate-100 bg-white shadow-sm hover:border-blue-200'
              }`}
            >
              <span
                className={`text-xs md:text-sm ${
                  !cell.inMonth
                    ? 'text-transparent'
                    : isToday
                      ? 'font-bold text-blue-700'
                      : 'font-medium text-charcoal'
                }`}
              >
                {cell.day}
              </span>

              {cell.inMonth && count > 0 && (
                <span className="mt-auto rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 md:px-2 md:py-1 md:text-xs">
                  {count} {count === 1 ? 'sessão' : 'sessões'}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {isLoading && (
        <p className="mt-4 text-center text-xs text-charcoal-muted">Carregando agenda...</p>
      )}
    </>
  );
}
