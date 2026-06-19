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
}

export function RecordPageSkeleton({ className = '' }: RecordPageSkeletonProps) {
  return (
    <div className={`space-y-4 px-5 py-6 lg:px-8 lg:py-8 ${className}`.trim()} aria-busy="true">
      <SkeletonBlock className="h-8 w-48" />
      <SkeletonBlock className="h-4 w-32" />
      <div className="mt-6 grid gap-4 lg:grid-cols-12">
        <SkeletonBlock className="h-72 lg:col-span-8" />
        <SkeletonBlock className="h-72 lg:col-span-4" />
      </div>
    </div>
  );
}
