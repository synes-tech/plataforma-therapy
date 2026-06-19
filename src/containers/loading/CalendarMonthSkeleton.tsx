import { Spinner } from './Spinner';
import { SkeletonBlock } from './Skeleton';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

interface CalendarMonthSkeletonProps {
  label?: string;
  className?: string;
}

/** Skeleton da grade mensal da agenda (cabeçalho dos dias + células + spinner). */
export function CalendarMonthSkeleton({
  label = 'Carregando agenda...',
  className = '',
}: CalendarMonthSkeletonProps) {
  return (
    <div
      className={`relative w-full rounded-2xl border border-slate-100 bg-white p-4 shadow-sm md:p-4 ${className}`.trim()}
      aria-busy="true"
      aria-live="polite"
      role="status"
      aria-label={label}
    >
      <div className="mb-3 grid grid-cols-7 gap-1.5 md:mb-2 md:gap-1">
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

      <div className="relative">
        <div className="grid grid-cols-7 gap-1.5 md:gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <SkeletonBlock key={i} className="min-h-[72px] rounded-xl md:h-16 md:min-h-0 md:rounded-lg lg:h-[4.5rem]" />
          ))}
        </div>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-white/55 backdrop-blur-[1px]">
          <Spinner size="md" />
          <p className="text-xs font-medium text-charcoal-muted">{label}</p>
        </div>
      </div>
    </div>
  );
}
