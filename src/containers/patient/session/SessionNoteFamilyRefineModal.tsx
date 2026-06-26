import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LoadingButton } from '@containers/loading';

interface SessionNoteFamilyRefineModalProps {
  isOpen: boolean;
  initialText: string;
  isSaving: boolean;
  onBack: () => void;
  onConfirm: (refinedText: string) => void;
}

function MaximizeIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5"
      />
    </svg>
  );
}

function MinimizeIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9H4V4m11 0h5v5M9 15H4v5m11 0h5v-5" />
    </svg>
  );
}

export function SessionNoteFamilyRefineModal({
  isOpen,
  initialText,
  isSaving,
  onBack,
  onConfirm,
}: SessionNoteFamilyRefineModalProps) {
  const titleId = useId();
  const textareaId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [refinedText, setRefinedText] = useState(initialText);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRefinedText(initialText);
      setIsFullscreen(false);
    }
  }, [initialText, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSaving) {
        onBack();
      }
    }

    document.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, isSaving, onBack]);

  useEffect(() => {
    if (!isOpen) return;
    dialogRef.current?.focus();
    const timer = window.setTimeout(() => textareaRef.current?.focus(), 120);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const trimmed = refinedText.trim();
  const canConfirm = trimmed.length >= 10 && !isSaving;

  return createPortal(
    <div
      className={`fixed inset-0 z-[60] flex animate-fade-in bg-slate-900/50 backdrop-blur-sm ${
        isFullscreen ? 'p-0' : 'items-center justify-center p-2 sm:p-3'
      }`}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`flex flex-col overflow-hidden bg-white shadow-2xl outline-none ${
          isFullscreen
            ? 'h-[100dvh] w-screen rounded-none'
            : 'h-[96dvh] w-full max-w-[98vw] animate-scale-in rounded-2xl sm:rounded-3xl'
        }`}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
          <div className="min-w-0 pr-2">
            <h2 id={titleId} className="font-serif text-lg font-medium tracking-tight text-charcoal sm:text-xl">
              Refinar para os pais
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-charcoal-muted">
              Edite o texto que a família receberá. A versão clínica bruta permanece privada no prontuário.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setIsFullscreen((current) => !current)}
              disabled={isSaving}
              aria-label={isFullscreen ? 'Restaurar tamanho do editor' : 'Maximizar editor em tela cheia'}
              aria-pressed={isFullscreen}
              className="rounded-full p-2 text-charcoal-muted transition-colors hover:bg-slate-100 hover:text-charcoal disabled:opacity-50"
            >
              {isFullscreen ? <MinimizeIcon /> : <MaximizeIcon />}
            </button>
            <button
              type="button"
              onClick={onBack}
              disabled={isSaving}
              aria-label="Voltar"
              className="rounded-full p-2 text-charcoal-muted transition-colors hover:bg-slate-100 hover:text-charcoal disabled:opacity-50"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4 sm:px-6">
          <div className="flex shrink-0 items-center justify-between gap-2">
            <label htmlFor={textareaId} className="text-xs font-semibold uppercase tracking-wide text-charcoal-muted">
              Texto que será enviado para a família
            </label>
            <span className="text-xs text-charcoal-muted">
              {trimmed.length < 10
                ? 'Mínimo de 10 caracteres'
                : `${trimmed.length} caracteres`}
            </span>
          </div>

          <div className="relative min-h-0 flex-1">
            <textarea
              ref={textareaRef}
              id={textareaId}
              value={refinedText}
              onChange={(event) => setRefinedText(event.target.value)}
              disabled={isSaving}
              spellCheck
              className="h-full min-h-[50dvh] w-full resize-none overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-[#F8FAF9] px-4 py-4 text-base leading-relaxed text-charcoal shadow-inner transition-colors focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10 [scrollbar-color:rgb(148_163_184)_rgb(241_245_249)] scrollbar-thin sm:min-h-0 sm:text-[15px] sm:leading-7"
              placeholder="Adapte a linguagem para os pais..."
            />
          </div>

          <p className="shrink-0 text-xs leading-relaxed text-charcoal-muted">
            Use a barra de rolagem ou maximize o editor para revisar todo o conteúdo antes de enviar.
          </p>
        </div>

        <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <button
            type="button"
            onClick={onBack}
            disabled={isSaving}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-charcoal transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            Voltar
          </button>
          <LoadingButton
            type="button"
            loading={isSaving}
            loadingLabel="Enviando..."
            disabled={!canConfirm}
            onClick={() => onConfirm(trimmed)}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-dark active:scale-[0.98] disabled:opacity-50"
          >
            Confirmar envio para a família
          </LoadingButton>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
