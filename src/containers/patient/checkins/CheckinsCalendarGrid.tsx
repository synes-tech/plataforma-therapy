import {
  CHECKIN_MONTHS,
  CHECKIN_WEEKDAYS,
  MOOD_LABELS,
  type CrisisCalendarDay,
} from './checkins-calendar.types';
import { buildCheckinMonthGrid } from './checkins-calendar.utils';

function ViewIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

interface CheckinsCalendarGridProps {
  viewYear: number;
  viewMonth: number;
  todayKey: string;
  filledMap: Map<string, CrisisCalendarDay>;
  isFetching: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onViewDay: (day: CrisisCalendarDay) => void;
}

export function CheckinsCalendarGrid({
  viewYear,
  viewMonth,
  todayKey,
  filledMap,
  isFetching,
  onPrevMonth,
  onNextMonth,
  onViewDay,
}: CheckinsCalendarGridProps) {
  const grid = buildCheckinMonthGrid(viewYear, viewMonth);

  return (
    <div className="w-full rounded-2xl border border-slate-100 bg-white p-4 shadow-sm md:p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onPrevMonth}
          disabled={isFetching}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-charcoal transition-colors hover:bg-slate-50 disabled:opacity-50"
          aria-label="Mês anterior"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="font-display text-base font-semibold text-charcoal md:text-lg">
          {CHECKIN_MONTHS[viewMonth - 1]} {viewYear}
        </h3>
        <button
          type="button"
          onClick={onNextMonth}
          disabled={isFetching}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-charcoal transition-colors hover:bg-slate-50 disabled:opacity-50"
          aria-label="Próximo mês"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1.5 md:gap-1">
        {CHECKIN_WEEKDAYS.map((w) => (
          <div
            key={w}
            className="pb-1 text-center text-xs font-semibold uppercase tracking-wider text-charcoal-muted md:pb-1 md:text-sm"
          >
            <span className="hidden sm:inline">{w}</span>
            <span className="sm:hidden">{w[0]}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5 md:gap-1">
        {grid.map((cell, i) => {
          if (cell.day === null) {
            return <div key={`empty-${i}`} className="min-h-[72px] md:h-16 md:min-h-0 lg:h-[4.5rem]" />;
          }

          const status = cell.dateKey ? filledMap.get(cell.dateKey) : undefined;
          const isToday = cell.dateKey === todayKey;
          const filled = !!status?.filled;
          const crisis = status?.crisis_occurred;

          return (
            <div
              key={cell.dateKey}
              className={`flex min-h-[72px] w-full flex-col rounded-xl border p-1.5 transition-colors md:h-16 md:min-h-0 md:rounded-lg md:p-1.5 lg:h-[4.5rem] ${
                filled
                  ? crisis
                    ? 'border-amber-200 bg-amber-50/80'
                    : 'border-emerald-200/80 bg-emerald-50/50'
                  : isToday
                    ? 'border-blue-400/60 bg-blue-50/40'
                    : 'border-slate-100 bg-white'
              }`}
            >
              <span
                className={`text-sm leading-none sm:text-base md:text-base lg:text-lg ${
                  isToday
                    ? 'font-bold text-blue-700'
                    : filled
                      ? crisis
                        ? 'font-semibold text-amber-900'
                        : 'font-semibold text-emerald-900'
                      : 'font-medium text-charcoal-muted'
                }`}
              >
                {cell.day}
              </span>

              {filled && status && (
                <>
                  <span
                    className={`mt-0.5 truncate text-[9px] font-medium leading-tight md:text-[10px] ${
                      crisis ? 'text-amber-800' : 'text-emerald-800'
                    }`}
                  >
                    <span className="sm:hidden" aria-hidden>
                      {MOOD_LABELS[status.mood_score]?.emoji ?? '📝'}
                    </span>
                    <span className="hidden sm:inline">{crisis ? 'Com crise' : 'Check-in'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onViewDay(status)}
                    disabled={isFetching}
                    className="mt-auto inline-flex h-6 w-full items-center justify-center gap-1 rounded-md bg-charcoal text-white transition-all hover:bg-charcoal-light active:scale-[0.98] disabled:opacity-50 md:h-7"
                    aria-label={`Visualizar check-in do dia ${cell.day}`}
                  >
                    <span className="text-[9px] font-bold uppercase tracking-wide sm:hidden">Ver</span>
                    <span className="hidden md:inline-flex md:items-center md:gap-1">
                      <ViewIcon />
                      <span className="text-[9px] font-bold uppercase tracking-wide">VISUALIZAR</span>
                    </span>
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/90 px-4 py-3">
        <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-charcoal-muted">
          Legenda
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-charcoal">
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 rounded border border-emerald-200/80 bg-emerald-50/50" />
            Preenchido
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 rounded border border-amber-200 bg-amber-50/80" />
            Com crise
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 rounded border border-slate-100 bg-white" />
            Sem registro
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 rounded border border-blue-400/60 bg-blue-50/40" />
            Hoje
          </span>
        </div>
      </div>
    </div>
  );
}
