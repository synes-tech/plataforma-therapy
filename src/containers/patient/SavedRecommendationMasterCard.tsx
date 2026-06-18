import { formatSavedRecommendationDate } from './saved-recommendations.format';
import { SavedRecommendationActionCard } from './SavedRecommendationActionCard';
import type { SavedRecommendationRecord } from './session-recommendations.types';

function TrashIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

interface SavedRecommendationMasterCardProps {
  item: SavedRecommendationRecord;
  onRequestDelete: () => void;
  isDeleting?: boolean;
}

export function SavedRecommendationMasterCard({
  item,
  onRequestDelete,
  isDeleting = false,
}: SavedRecommendationMasterCardProps) {
  const { conteudo } = item;
  const dateLabel = formatSavedRecommendationDate(item.criado_em);

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <time
            dateTime={item.criado_em}
            className="text-sm font-semibold uppercase tracking-wider text-charcoal-muted"
          >
            {dateLabel}
          </time>
        </div>

        <button
          type="button"
          onClick={onRequestDelete}
          disabled={isDeleting}
          aria-label="Remover recomendação salva"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-transparent text-charcoal-muted transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-error disabled:opacity-50"
        >
          <TrashIcon />
        </button>
      </header>

      {conteudo.summary?.trim() && (
        <p className="mb-4 text-sm leading-relaxed text-charcoal">{conteudo.summary.trim()}</p>
      )}

      <div className="flex flex-col gap-3">
        {conteudo.recommendations.map((rec, index) => (
          <SavedRecommendationActionCard key={`${rec.title}-${index}`} recommendation={rec} />
        ))}
      </div>
    </article>
  );
}
