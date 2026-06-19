import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LoadingButton } from '@containers/loading';
import {
  CONTEXT_SOURCE_OPTIONS,
  EMPTY_CONTEXT_FLAGS,
  hasAnyContextFlag,
  type RecommendationContextFlags,
} from './session-recommendations.context';

interface RecommendationsContextModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (flags: RecommendationContextFlags) => void;
  isSubmitting?: boolean;
  initialFlags?: RecommendationContextFlags;
}

export function RecommendationsContextModal({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting = false,
  initialFlags,
}: RecommendationsContextModalProps) {
  const [flags, setFlags] = useState<RecommendationContextFlags>(
    initialFlags ?? EMPTY_CONTEXT_FLAGS,
  );

  useEffect(() => {
    if (isOpen) {
      setFlags(initialFlags ?? EMPTY_CONTEXT_FLAGS);
    }
  }, [isOpen, initialFlags]);

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const canSubmit = hasAnyContextFlag(flags) && !isSubmitting;

  function toggle(key: keyof RecommendationContextFlags) {
    setFlags((f) => ({ ...f, [key]: !f[key] }));
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-slate-950/60 p-0 backdrop-blur-md md:items-center md:p-4"
      onClick={() => !isSubmitting && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="rec-context-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full animate-slide-up flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-gradient-to-br from-slate-900/95 via-slate-900 to-slate-800/90 shadow-2xl shadow-primary/10 outline-none md:max-h-[90dvh] md:max-w-lg md:animate-scale-in md:rounded-2xl"
      >
        <div className="mx-auto mb-1 mt-2 h-1.5 w-12 shrink-0 rounded-full bg-white/20 md:hidden" />

        <header className="shrink-0 border-b border-white/10 px-6 py-4">
          <h2 id="rec-context-title" className="font-display text-lg font-semibold text-white">
            Fontes de contexto
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Escolha o que a IA deve analisar. Combine uma ou mais opções.
          </p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <ul className="space-y-3">
            {CONTEXT_SOURCE_OPTIONS.map((opt) => {
              const checked = flags[opt.key];
              return (
                <li key={opt.key}>
                  <button
                    type="button"
                    onClick={() => toggle(opt.key)}
                    disabled={isSubmitting}
                    className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition-all ${
                      checked
                        ? 'border-primary/50 bg-primary/10 shadow-[0_0_24px_rgba(13,148,136,0.15)]'
                        : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/[0.07]'
                    } disabled:opacity-50`}
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                        checked ? 'border-primary bg-primary text-white' : 'border-slate-500 bg-transparent'
                      }`}
                      aria-hidden
                    >
                      {checked && (
                        <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M2 6l3 3 5-6" />
                        </svg>
                      )}
                    </span>
                    <span>
                      <span className="block text-sm font-medium text-slate-100">{opt.label}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">{opt.description}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {!hasAnyContextFlag(flags) && (
            <p className="mt-4 text-center text-xs text-amber-400/90" role="status">
              Selecione pelo menos uma fonte para continuar.
            </p>
          )}
        </div>

        <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-white/10 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-white/15 px-5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 disabled:opacity-50"
          >
            Cancelar
          </button>
          <LoadingButton
            type="button"
            disabled={!canSubmit}
            loading={isSubmitting}
            loadingLabel="Gerando..."
            onClick={() => onConfirm(flags)}
            className="h-11 border border-primary/40 bg-primary/20 px-6 font-medium text-primary-100 shadow-[0_0_20px_rgba(13,148,136,0.25)] hover:bg-primary/30 hover:shadow-[0_0_28px_rgba(13,148,136,0.35)] disabled:opacity-40"
          >
            Gerar recomendações
          </LoadingButton>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
