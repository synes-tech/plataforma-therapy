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
      className={`relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-white ${className}`.trim()}
      aria-busy="true"
      aria-live="polite"
      role="status"
      aria-label={label}
    >
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

      <div className="relative">
        <div className="grid grid-cols-7">
          {Array.from({ length: 42 }).map((_, i) => (
            <SkeletonBlock key={i} className="min-h-[5.75rem] rounded-none border-b border-r border-slate-100 sm:min-h-[6.75rem] lg:min-h-[7.5rem]" />
          ))}
        </div>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/55">
          <Spinner size="md" />
          <p className="text-xs font-medium text-charcoal-muted">{label}</p>
        </div>
      </div>
    </div>
  );
}
