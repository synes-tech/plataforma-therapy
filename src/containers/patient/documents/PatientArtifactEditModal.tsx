import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LoadingButton } from '@containers/loading';
import { MarkdownDocumentEditor } from '@shared/ui/MarkdownDocumentEditor';
import { validateClinicalMarkdown } from '@shared/lib/clinical-markdown-normalize';
import { resolveArtifactTitle } from './patient-artifacts.format';
import type { PatientArtifact } from './patient-artifacts.types';

export interface PatientArtifactSavePayload {
  titulo: string;
  conteudo_texto: string;
}

export interface PatientArtifactEditModalProps {
  artifact: PatientArtifact | null;
  isOpen: boolean;
  onBack: () => void;
  onClose: () => void;
  onSave: (payload: PatientArtifactSavePayload) => Promise<void>;
}

const topBtnClass =
  'inline-flex min-h-12 flex-1 items-center justify-center rounded-xl px-6 text-sm font-bold uppercase tracking-wide transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-14 sm:flex-none sm:min-w-[10rem] sm:text-base';

const SUCCESS_DISMISS_MS = 2000;
const SUCCESS_CLOSE_DELAY_MS = 1200;

type SaveMode = 'stay' | 'exit' | null;

export function PatientArtifactEditModal({
  artifact,
  isOpen,
  onBack,
  onClose,
  onSave,
}: PatientArtifactEditModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const isSavingRef = useRef(false);
  const successTimeoutRef = useRef<number | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);

  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [editorReady, setEditorReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMode, setSaveMode] = useState<SaveMode>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const artifactId = artifact?.id ?? null;
  const isSaving = saveMode !== null;
  isSavingRef.current = isSaving;

  useEffect(() => {
    if (!artifact || !isOpen || !artifactId) {
      setEditorReady(false);
      return;
    }

    setTitulo(resolveArtifactTitle(artifact));
    setConteudo(artifact.conteudo_texto);
    setError(null);
    setSaveMode(null);
    setSaveSuccess(false);
    setEditorReady(true);
    // Recarrega o editor apenas ao abrir ou trocar de documento — não durante salvamento otimista.
  }, [artifactId, isOpen]);

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) window.clearTimeout(successTimeoutRef.current);
      if (closeTimeoutRef.current) window.clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isSavingRef.current) onBack();
    }

    document.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onBack]);

  useEffect(() => {
    if (isOpen) dialogRef.current?.focus();
  }, [isOpen]);

  function clearSuccessTimers() {
    if (successTimeoutRef.current) {
      window.clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }

  async function handleSave(closeAfterSave: boolean) {
    if (isSaving) return;

    const trimmedTitle = titulo.trim();
    const contentValidation = validateClinicalMarkdown(conteudo.trim() || conteudo);

    if (!trimmedTitle) {
      setError('Informe um título para o documento.');
      return;
    }

    if (!contentValidation.ok) {
      setError(contentValidation.message);
      return;
    }

    setError(null);
    clearSuccessTimers();
    setSaveSuccess(false);
    setSaveMode(closeAfterSave ? 'exit' : 'stay');

    try {
      await onSave({ titulo: trimmedTitle, conteudo_texto: contentValidation.normalized });

      setSaveSuccess(true);
      setSaveMode(null);

      if (closeAfterSave) {
        closeTimeoutRef.current = window.setTimeout(() => {
          onClose();
        }, SUCCESS_CLOSE_DELAY_MS);
        return;
      }

      successTimeoutRef.current = window.setTimeout(() => {
        setSaveSuccess(false);
      }, SUCCESS_DISMISS_MS);
    } catch (err) {
      setSaveMode(null);
      setError(err instanceof Error ? err.message : 'Não foi possível salvar as alterações.');
    }
  }

  if (!isOpen || !artifact) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-white">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="flex h-full w-full flex-col overflow-hidden outline-none"
      >
        <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
            <div className="flex gap-2 sm:gap-3">
              <button
                type="button"
                onClick={onBack}
                disabled={isSaving}
                className={`${topBtnClass} border border-slate-200 bg-white text-charcoal hover:bg-slate-50`}
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className={`${topBtnClass} border border-charcoal/10 bg-charcoal text-white hover:bg-charcoal-light`}
              >
                Fechar
              </button>
            </div>
            <h2 id={titleId} className="font-serif text-lg font-medium tracking-tight text-charcoal sm:text-xl">
              Editar documento
            </h2>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#F8FAF9] px-4 py-4 sm:px-6 sm:py-5">
          <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col">
            {editorReady ? (
              <MarkdownDocumentEditor
                key={artifact.id}
                documentKey={artifact.id}
                title={titulo}
                onTitleChange={setTitulo}
                content={conteudo}
                onContentChange={setConteudo}
                fillHeight
              />
            ) : (
              <div className="min-h-0 flex-1 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
            )}
            {error ? (
              <p className="mt-3 shrink-0 text-sm text-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </div>

        <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
          <div className="mx-auto flex w-full max-w-6xl justify-end">
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
              <LoadingButton
                type="button"
                onClick={() => void handleSave(false)}
                loading={saveMode === 'stay'}
                loadingLabel="Salvando..."
                disabled={saveMode === 'exit' || saveSuccess}
                variant="secondary"
                className="min-h-12 w-full px-6 text-sm font-semibold sm:w-auto sm:min-w-[9rem]"
              >
                Salvar
              </LoadingButton>
              <LoadingButton
                type="button"
                onClick={() => void handleSave(true)}
                loading={saveMode === 'exit'}
                loadingLabel="Salvando..."
                disabled={saveMode === 'stay' || saveSuccess}
                className="min-h-12 w-full px-6 text-sm font-semibold sm:w-auto sm:min-w-[11rem]"
              >
                Salvar e sair
              </LoadingButton>
              {saveSuccess ? (
                <p
                  className="flex min-h-12 items-center justify-center gap-2 text-sm font-semibold text-mint-dark sm:justify-start"
                  role="status"
                  aria-live="polite"
                >
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Salvo com sucesso
                </p>
              ) : null}
            </div>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
