import { Spinner } from './Spinner';

interface SkeletonBlockProps {
  className?: string;
}

export function SkeletonBlock({ className = '' }: SkeletonBlockProps) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-slate-100 ${className}`.trim()}
      aria-hidden
    />
  );
}

interface ListPageSkeletonProps {
  rows?: number;
  rowClassName?: string;
  className?: string;
}

export function ListPageSkeleton({
  rows = 3,
  rowClassName = 'h-24',
  className = '',
}: ListPageSkeletonProps) {
  return (
    <div className={`flex flex-col gap-3 ${className}`.trim()} aria-busy="true" aria-label="Carregando lista">
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonBlock key={i} className={rowClassName} />
      ))}
    </div>
  );
}

interface CardGridSkeletonProps {
  count?: number;
  className?: string;
}

export function CardGridSkeleton({ count = 6, className = '' }: CardGridSkeletonProps) {
  return (
    <div
      className={`grid grid-cols-2 gap-2 sm:grid-cols-3 md:gap-3 ${className}`.trim()}
      aria-busy="true"
      aria-label="Carregando"
    >
      {Array.from({ length: count }, (_, i) => (
        <SkeletonBlock key={i} className="aspect-square rounded-xl" />
      ))}
    </div>
  );
}

interface RecordPageSkeletonProps {
  className?: string;
  label?: string;
}

export function RecordPageSkeleton({
  className = '',
  label = 'Carregando prontuário...',
}: RecordPageSkeletonProps) {
  return (
    <div
      className={`bg-[#F8FAF9] px-4 py-6 pb-8 sm:px-6 lg:px-8 lg:py-8 ${className}`.trim()}
      aria-busy="true"
      aria-live="polite"
      role="status"
      aria-label={label}
    >
      <SkeletonBlock className="h-4 w-36" />

      <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <SkeletonBlock className="h-16 w-16 shrink-0 rounded-full" />
          <div className="space-y-2">
            <SkeletonBlock className="h-8 w-56" />
            <SkeletonBlock className="h-4 w-32" />
            <div className="flex gap-2">
              <SkeletonBlock className="h-5 w-14 rounded-full" />
              <SkeletonBlock className="h-5 w-20 rounded-full" />
              <SkeletonBlock className="h-5 w-16 rounded-full" />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <SkeletonBlock className="h-9 w-28 rounded-lg" />
          <SkeletonBlock className="h-9 w-24 rounded-lg" />
          <SkeletonBlock className="h-9 w-32 rounded-lg" />
          <SkeletonBlock className="h-9 w-28 rounded-lg" />
        </div>
      </div>

      <SkeletonBlock className="mt-6 h-12 w-full rounded-xl" />

      <div className="relative mt-6 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        <SkeletonBlock className="h-[min(28rem,60dvh)] rounded-2xl" />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/55 backdrop-blur-[1px]">
          <Spinner size="md" />
          <p className="text-xs font-medium text-charcoal-muted">{label}</p>
        </div>
      </div>
    </div>
  );
}
