import type { ReactNode } from 'react';

interface SavedRecommendationsTimelineProps {
  children: ReactNode;
}

/** Lista semântica — mobile: cards empilhados; desktop: coluna fixa de 44px para o eixo. */
export function SavedRecommendationsTimeline({ children }: SavedRecommendationsTimelineProps) {
  return (
    <ol className="relative m-0 list-none p-0" role="list">
      {children}
    </ol>
  );
}

interface SavedRecommendationTimelineItemProps {
  children: ReactNode;
  isLast?: boolean;
}

export function SavedRecommendationTimelineItem({
  children,
  isLast = false,
}: SavedRecommendationTimelineItemProps) {
  return (
    <li
      className="relative pb-8 last:pb-0 sm:grid sm:grid-cols-[44px_minmax(0,1fr)] sm:gap-6"
      role="listitem"
    >
      <div className="relative hidden sm:block" aria-hidden>
        <div
          className={`absolute left-[21px] top-0 w-0.5 -translate-x-1/2 bg-slate-200 ${
            isLast ? 'h-6' : 'bottom-0 h-full'
          }`}
        />
        <div className="absolute left-[21px] top-6 z-10 h-3 w-3 -translate-x-1/2 rounded-full border-4 border-ice-light bg-primary" />
      </div>

      <div className="min-w-0 sm:col-start-2">{children}</div>
    </li>
  );
}
