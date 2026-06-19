import { Spinner } from '@containers/loading/Spinner';
import { SkeletonBlock } from '@containers/loading/Skeleton';

interface PatientSessionsTableSkeletonProps {
  rows?: number;
}

export function PatientSessionsTableSkeleton({ rows = 5 }: PatientSessionsTableSkeletonProps) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"
      aria-busy="true"
      role="status"
      aria-label="Carregando sessões"
    >
      <div className="hidden md:block">
        <div className="border-b border-slate-100 px-5 py-3">
          <SkeletonBlock className="h-4 w-full max-w-md" />
        </div>
        <div className="divide-y divide-slate-100 px-5 py-2">
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonBlock key={i} className="my-2 h-12 rounded-lg" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-slate-100 md:hidden">
        {Array.from({ length: Math.min(rows, 4) }).map((_, i) => (
          <SkeletonBlock key={i} className="m-4 h-16 rounded-xl" />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/55 backdrop-blur-[1px]">
        <Spinner size="md" />
        <p className="text-xs font-medium text-charcoal-muted">Carregando sessões...</p>
      </div>
    </div>
  );
}
