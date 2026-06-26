import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AiMarkdownContent } from '@shared/ui/AiMarkdownContent';
import { ARTIFACT_BADGE_CONFIG, getArtifactVisibilityBadge } from './patient-artifacts.constants';
import { PatientArtifactActions } from './PatientArtifactActions';
import { PatientCopilotFamilyShareToggle } from '../copilot/PatientCopilotFamilyShareToggle';
import {
  formatArtifactDate,
  resolveArtifactTitle,
} from './patient-artifacts.format';
import type { PatientArtifact } from './patient-artifacts.types';

interface PatientArtifactReadModalProps {
  artifact: PatientArtifact | null;
  onClose: () => void;
  onEdit?: (artifact: PatientArtifact) => void;
  onExportPdf: (artifact: PatientArtifact) => void;
  onRequestDelete: (artifact: PatientArtifact) => void;
  onVisibilityChange?: (artifactId: string, shared: boolean) => void;
  isUpdatingVisibility?: boolean;
  exportingId: string | null;
  deletingId: string | null;
}

export function PatientArtifactReadModal({
  artifact,
  onClose,
  onEdit,
  onExportPdf,
  onRequestDelete,
  onVisibilityChange,
  isUpdatingVisibility = false,
  exportingId,
  deletingId,
}: PatientArtifactReadModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const isOpen = artifact !== null;

  const badge = artifact ? ARTIFACT_BADGE_CONFIG[artifact.tipo_artefato] : null;
  const visibilityBadge = artifact ? getArtifactVisibilityBadge(artifact.compartilhado_familia) : null;
  const title = artifact ? resolveArtifactTitle(artifact) : 'Documento';
  const dateLabel = artifact ? formatArtifactDate(artifact.criado_em) : '';

  useEffect(() => {
    if (!isOpen) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) dialogRef.current?.focus();
  }, [isOpen]);

  if (!isOpen || !artifact || !badge) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex animate-fade-in bg-slate-900/45 p-2 backdrop-blur-sm sm:p-3 md:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full animate-scale-in flex-col overflow-hidden rounded-2xl bg-white shadow-2xl outline-none"
      >
        <header className="flex shrink-0 flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:px-6 sm:py-5 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="font-serif text-lg font-medium tracking-tight text-charcoal md:text-xl"
            >
              {title}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${badge.className}`}
              >
                {badge.label}
              </span>
              {visibilityBadge ? (
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${visibilityBadge.className}`}
                >
                  {visibilityBadge.label}
                </span>
              ) : null}
              {dateLabel ? (
                <time dateTime={artifact.criado_em} className="text-xs text-charcoal-muted">
                  {dateLabel}
                </time>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <PatientArtifactActions
              artifact={artifact}
              onEdit={onEdit}
              onExportPdf={onExportPdf}
              onRequestDelete={onRequestDelete}
              exportingId={exportingId}
              deletingId={deletingId}
              layout="modal"
            />
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-charcoal-muted transition-colors hover:bg-slate-50 hover:text-charcoal"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/40 px-4 py-5 sm:px-6 sm:py-6">
          {onVisibilityChange && !artifact.is_legacy ? (
            <div className="mx-auto mb-4 max-w-4xl">
              <PatientCopilotFamilyShareToggle
                checked={artifact.compartilhado_familia}
                onChange={(shared) => onVisibilityChange(artifact.id, shared)}
                disabled={isUpdatingVisibility}
              />
            </div>
          ) : null}

          <div className="mx-auto max-w-4xl rounded-xl border border-slate-100 bg-white px-5 py-5 shadow-sm sm:px-6 sm:py-6">
            <AiMarkdownContent
              content={artifact.conteudo_texto}
              variant="light"
              className="md:text-base md:leading-7"
            />
          </div>
        </div>

        <footer className="flex shrink-0 flex-col gap-3 border-t border-slate-100 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs text-charcoal-muted">Pressione Esc para fechar</p>
          <PatientArtifactActions
            artifact={artifact}
            onEdit={onEdit}
            onExportPdf={onExportPdf}
            onRequestDelete={onRequestDelete}
            exportingId={exportingId}
            deletingId={deletingId}
            layout="modal"
          />
        </footer>
      </div>
    </div>,
    document.body,
  );
}
