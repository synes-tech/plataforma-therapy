import type { ReactNode } from 'react';
import { SkeletonBlock } from '@containers/loading';

interface PatientArtifactsGridProps {
  children: ReactNode;
  isFetching?: boolean;
}

function ArtifactCardSkeleton() {
  return <SkeletonBlock className="h-48 rounded-2xl" />;
}

export function PatientArtifactsGrid({ children, isFetching = false }: PatientArtifactsGridProps) {
  return (
    <div className="relative">
      {isFetching && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden rounded-full bg-slate-100"
          aria-hidden
        >
          <div className="h-full w-1/3 animate-pulse bg-primary/60" />
        </div>
      )}

      <div className="mx-auto w-full max-w-3xl gap-4 max-lg:flex max-lg:flex-col lg:max-w-none lg:columns-2 xl:columns-3 [&>*]:mb-4">
        {children}
      </div>
    </div>
  );
}

export function PatientArtifactsGridSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl gap-4 max-lg:flex max-lg:flex-col lg:max-w-none lg:columns-2 xl:columns-3 [&>*]:mb-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="break-inside-avoid">
          <ArtifactCardSkeleton />
        </div>
      ))}
    </div>
  );
}
