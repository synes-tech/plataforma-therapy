import { Spinner } from './Spinner';
import { SkeletonBlock } from './Skeleton';

interface CalendarWeekSkeletonProps {
  weekDays: string[];
  todayISO: string;
  label?: string;
}

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function formatDayHeader(dayISO: string, todayISO: string) {
  const date = new Date(`${dayISO}T12:00:00`);
  return {
    weekday: WEEKDAY_SHORT[date.getDay()] ?? '',
    day: date.getDate(),
    isToday: dayISO === todayISO,
  };
}

/** Skeleton da visão semanal da agenda. */
export function CalendarWeekSkeleton({
  weekDays,
  todayISO,
  label = 'Carregando agenda da semana...',
}: CalendarWeekSkeletonProps) {
  return (
    <div
      className="relative flex max-h-[calc(100dvh-12.5rem)] min-h-[28rem] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white"
      aria-busy="true"
      aria-live="polite"
      role="status"
      aria-label={label}
    >
      <div className="grid shrink-0 grid-cols-[2.75rem_repeat(7,minmax(0,1fr))] border-b border-slate-200 sm:grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]">
        <div aria-hidden />
        {weekDays.map((dayISO) => {
          const { weekday, day, isToday } = formatDayHeader(dayISO, todayISO);
          return (
            <div key={dayISO} className="border-l border-slate-100 px-0.5 py-1.5 text-center">
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
            </div>
          );
        })}
      </div>

      <div className="relative min-h-0 flex-1 p-4">
        <SkeletonBlock className="h-full min-h-[240px] rounded-xl" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/60">
          <Spinner size="md" />
          <p className="text-xs font-medium text-charcoal-muted">{label}</p>
        </div>
      </div>
    </div>
  );
}
