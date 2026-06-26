import { AiMarkdownContent } from '@shared/ui/AiMarkdownContent';
import { ARTIFACT_BADGE_CONFIG } from './patient-artifacts.constants';
import { formatArtifactDate } from './patient-artifacts.format';
import type { PatientArtifact } from './patient-artifacts.types';

function ClipboardIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
      />
    </svg>
  );
}

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

interface PatientArtifactCardProps {
  artifact: PatientArtifact;
  onCopy: () => void;
  onRequestDelete: () => void;
  isCopying?: boolean;
  isDeleting?: boolean;
}

export function PatientArtifactCard({
  artifact,
  onCopy,
  onRequestDelete,
  isCopying = false,
  isDeleting = false,
}: PatientArtifactCardProps) {
  const badge = ARTIFACT_BADGE_CONFIG[artifact.tipo_artefato];
  const dateLabel = formatArtifactDate(artifact.criado_em);

  return (
    <article className="break-inside-avoid overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <header className="flex items-start justify-between gap-3 border-b border-slate-50 px-4 py-3 sm:px-5">
        <time dateTime={artifact.criado_em} className="text-sm font-medium text-charcoal">
          {dateLabel}
        </time>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${badge.className}`}
        >
          {badge.label}
        </span>
      </header>

      <div className="px-4 py-4 sm:px-5">
        <AiMarkdownContent content={artifact.conteudo_texto} variant="compact" />
      </div>

      <footer className="flex items-center justify-end gap-1 border-t border-slate-50 px-3 py-2 sm:px-4">
        <button
          type="button"
          onClick={onCopy}
          disabled={isCopying}
          aria-label="Copiar texto"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-charcoal-muted transition-colors hover:bg-slate-50 hover:text-primary disabled:opacity-50"
        >
          <ClipboardIcon />
        </button>
        <button
          type="button"
          onClick={onRequestDelete}
          disabled={isDeleting}
          aria-label="Excluir documento"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-charcoal-muted transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
        >
          <TrashIcon />
        </button>
      </footer>
    </article>
  );
}
