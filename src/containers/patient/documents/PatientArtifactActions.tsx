import type { PatientArtifact } from './patient-artifacts.types';

function ExportPdfIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
      />
    </svg>
  );
}

const iconBtnClass =
  'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-charcoal-muted transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-charcoal disabled:cursor-not-allowed disabled:opacity-50';

interface PatientArtifactActionsProps {
  artifact: PatientArtifact;
  onView?: (artifact: PatientArtifact) => void;
  onExportPdf: (artifact: PatientArtifact) => void;
  onRequestDelete: (artifact: PatientArtifact) => void;
  exportingId: string | null;
  deletingId: string | null;
  layout?: 'table' | 'modal';
}

export function PatientArtifactActions({
  artifact,
  onView,
  onExportPdf,
  onRequestDelete,
  exportingId,
  deletingId,
  layout = 'table',
}: PatientArtifactActionsProps) {
  const isExporting = exportingId === artifact.id;
  const isDeleting = deletingId === artifact.id;
  const isBusy = isExporting || isDeleting;

  if (layout === 'modal') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onExportPdf(artifact)}
          disabled={isBusy}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-medium text-charcoal transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
        >
          {isExporting ? (
            'Gerando PDF...'
          ) : (
            <>
              <ExportPdfIcon />
              Exportar PDF
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => onRequestDelete(artifact)}
          disabled={isBusy}
          className="inline-flex h-9 items-center justify-center rounded-lg border border-error/20 bg-white px-4 text-xs font-medium text-error transition-colors hover:bg-error-light/40 disabled:opacity-50"
        >
          {isDeleting ? 'Removendo...' : 'Remover'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      {onView ? (
        <button
          type="button"
          onClick={() => onView(artifact)}
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-charcoal px-3.5 text-xs font-semibold uppercase tracking-wide text-white shadow-sm transition-all hover:bg-charcoal-light active:scale-[0.98]"
          aria-label="Visualizar documento"
        >
          VISUALIZAR
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => onExportPdf(artifact)}
        disabled={isBusy}
        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold tracking-wide text-charcoal transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
        aria-label="Exportar ou compartilhar PDF"
        title="Exportar PDF"
      >
        {isExporting ? (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        ) : (
          <>
            <ExportPdfIcon />
            PDF
          </>
        )}
      </button>
      <button
        type="button"
        onClick={() => onRequestDelete(artifact)}
        disabled={isBusy}
        className={`${iconBtnClass} hover:border-error/30 hover:bg-error-light/40 hover:text-error`}
        aria-label="Remover documento"
        title="Remover"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}
