import { Spinner } from './Spinner';
import { SkeletonBlock } from './Skeleton';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Skeleton da aba Check-ins (KPIs + calendário no padrão da agenda). */
export function CrisisCheckinsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite" role="status" aria-label="Carregando check-ins">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <SkeletonBlock className="mx-auto mb-4 h-6 w-40 rounded-lg" />
        <div className="mb-3 grid grid-cols-7 gap-1.5 md:gap-1">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="text-center text-xs font-semibold uppercase tracking-wider text-charcoal-muted/70"
            >
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5 md:gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <SkeletonBlock key={i} className="min-h-[72px] rounded-xl md:h-16 md:min-h-0 md:rounded-lg lg:h-[4.5rem]" />
          ))}
        </div>
        <SkeletonBlock className="mt-4 h-16 rounded-xl" />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/55 backdrop-blur-[1px]">
          <Spinner size="md" />
          <p className="text-xs font-medium text-charcoal-muted">Carregando check-ins...</p>
        </div>
      </div>
    </div>
  );
}
