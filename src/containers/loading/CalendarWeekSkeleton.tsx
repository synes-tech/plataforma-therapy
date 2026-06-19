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
      className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
      aria-busy="true"
      aria-live="polite"
      role="status"
      aria-label={label}
    >
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

      <div className="relative min-h-[320px] p-4 md:min-h-[420px]">
        <SkeletonBlock className="h-full min-h-[280px] rounded-xl" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/60">
          <Spinner size="md" />
          <p className="text-xs font-medium text-charcoal-muted">{label}</p>
        </div>
      </div>
    </div>
  );
}
