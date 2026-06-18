import {
  CATEGORY_CONFIG,
  PRIORITY_DOT,
  type SessionRecommendation,
} from './session-recommendations.types';

interface SavedRecommendationActionCardProps {
  recommendation: SessionRecommendation;
}

export function SavedRecommendationActionCard({ recommendation }: SavedRecommendationActionCardProps) {
  const config = CATEGORY_CONFIG[recommendation.category] ?? CATEGORY_CONFIG.observation;
  const priorityClass = PRIORITY_DOT[recommendation.priority] ?? PRIORITY_DOT.medium;

  return (
    <article className="rounded-xl border border-slate-100/80 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center gap-2 gap-y-1">
        <span className="text-base leading-none" aria-hidden>
          {config.icon}
        </span>
        <h4 className="min-w-0 flex-1 text-sm font-semibold text-charcoal">{recommendation.title}</h4>
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${priorityClass}`}
          title={`Prioridade ${recommendation.priority}`}
          aria-hidden
        />
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${config.color}`}
        >
          {config.label}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-charcoal-muted">{recommendation.description}</p>
    </article>
  );
}
