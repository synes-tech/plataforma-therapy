import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation } from '@tanstack/react-query';
import { LoadingButton, Spinner } from '@containers/loading';
import { callFunction } from '@shared/lib/api';
import { StandardModal } from '@shared/ui/StandardModal';
import {
  FAMILY_CATEGORY_LABELS,
  FAMILY_MOOD_LABELS,
  FAMILY_SLEEP_LABELS,
  type FamilyAudioCheckinDraft,
  type FamilyAudioCheckinSubmitResponse,
} from './family-audio-checkin.types';

interface FamilyAudioCheckinModalProps {
  patientId: string;
  draft: FamilyAudioCheckinDraft | null;
  onClose: () => void;
  onSuccess: () => void;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : true,
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return isMobile;
}

function ExtractedSummary({ extracted }: { extracted: FamilyAudioCheckinSubmitResponse['extracted'] }) {
  const mood = FAMILY_MOOD_LABELS[extracted.mood_score];
  const sleep = FAMILY_SLEEP_LABELS[extracted.sleep_quality];

  return (
    <div className="rounded-xl border border-mint/30 bg-mint/10 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-mint-dark">Identificado no relato</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {mood ? (
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-charcoal">
            {mood.emoji} Humor: {mood.label}
          </span>
        ) : null}
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-charcoal">
          Sono: {sleep}
        </span>
        {extracted.crisis_occurred ? (
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
            Crise {extracted.crisis_level ?? '?'}/5
          </span>
        ) : (
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-charcoal">
            Sem crise registrada
          </span>
        )}
        {extracted.categories.map((cat) => (
          <span key={cat} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            {FAMILY_CATEGORY_LABELS[cat] ?? cat}
          </span>
        ))}
      </div>
    </div>
  );
}

function ModalBody({
  draft,
  isSubmitting,
  submitError,
  lastExtracted,
}: {
  draft: FamilyAudioCheckinDraft;
  isSubmitting: boolean;
  submitError: string | null;
  lastExtracted: FamilyAudioCheckinSubmitResponse['extracted'] | null;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-charcoal-muted">Transcrição do áudio</p>
        <div className="mt-2 max-h-[min(50vh,28rem)] overflow-y-auto rounded-xl border border-slate-200 bg-[#F8FAF9] px-4 py-4 text-sm leading-relaxed text-charcoal scrollbar-thin">
          {draft.transcricao}
        </div>
      </div>

      {lastExtracted ? <ExtractedSummary extracted={lastExtracted} /> : null}

      {isSubmitting ? (
        <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3" role="status">
          <Spinner size="sm" />
          <p className="text-sm text-charcoal-muted">Analisando o relato e registrando o check-in…</p>
        </div>
      ) : null}

      {submitError ? (
        <p className="rounded-xl border border-error/15 bg-error-light/40 px-4 py-3 text-sm text-error" role="alert">
          {submitError}
        </p>
      ) : null}
    </div>
  );
}

export function FamilyAudioCheckinModal({
  patientId,
  draft,
  onClose,
  onSuccess,
}: FamilyAudioCheckinModalProps) {
  const isOpen = draft !== null;
  const isMobile = useIsMobile();
  const [lastExtracted, setLastExtracted] = useState<FamilyAudioCheckinSubmitResponse['extracted'] | null>(null);

  const submitMutation = useMutation({
    mutationFn: (payload: FamilyAudioCheckinDraft) =>
      callFunction<FamilyAudioCheckinSubmitResponse>('submit-family-audio-checkin', {
        patient_id: patientId,
        entry_date: payload.entryDate,
        transcricao: payload.transcricao,
        audio_note_url: payload.audioUrl,
        duration_seconds: payload.durationSeconds,
      }),
    onSuccess: (data) => {
      setLastExtracted(data.extracted);
      window.setTimeout(() => {
        setLastExtracted(null);
        onSuccess();
      }, 1400);
    },
  });

  useEffect(() => {
    if (!isOpen) {
      setLastExtracted(null);
    }
  }, [isOpen]);

  const isSubmitting = submitMutation.isPending;
  const submitError = submitMutation.error instanceof Error ? submitMutation.error.message : null;

  const footer = (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={onClose}
        disabled={isSubmitting}
        className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-charcoal transition-colors hover:bg-slate-50 disabled:opacity-50 sm:min-w-[8rem]"
      >
        Cancelar
      </button>
      <LoadingButton
        type="button"
        loading={isSubmitting}
        loadingLabel="Registrando..."
        disabled={!draft || !!lastExtracted}
        onClick={() => draft && submitMutation.mutate(draft)}
        className="inline-flex h-12 min-w-[10rem] items-center justify-center rounded-xl bg-mint-dark px-6 text-sm font-semibold text-white shadow-sm transition-all hover:bg-mint-dark/90 active:scale-[0.98] disabled:opacity-50"
      >
        Fazer check-in
      </LoadingButton>
    </div>
  );

  if (isMobile) {
    return (
      <StandardModal
        isOpen={isOpen}
        onClose={onClose}
        title="Seu relato em áudio"
        size="2xl"
        footer={footer}
      >
        {draft ? (
          <ModalBody
            draft={draft}
            isSubmitting={isSubmitting}
            submitError={submitError}
            lastExtracted={lastExtracted}
          />
        ) : null}
      </StandardModal>
    );
  }

  return (
    <FamilyAudioCheckinModalDesktop
      isOpen={isOpen}
      draft={draft}
      footer={footer}
      onClose={onClose}
      isSubmitting={isSubmitting}
      submitError={submitError}
      lastExtracted={lastExtracted}
    />
  );
}

function FamilyAudioCheckinModalDesktop({
  isOpen,
  draft,
  footer,
  onClose,
  isSubmitting,
  submitError,
  lastExtracted,
}: {
  isOpen: boolean;
  draft: FamilyAudioCheckinDraft | null;
  footer: React.ReactNode;
  onClose: () => void;
  isSubmitting: boolean;
  submitError: string | null;
  lastExtracted: FamilyAudioCheckinSubmitResponse['extracted'] | null;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    }

    document.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, isSubmitting, onClose]);

  useEffect(() => {
    if (isOpen) dialogRef.current?.focus();
  }, [isOpen]);

  if (!isOpen || !draft) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] hidden animate-fade-in bg-slate-900/50 p-4 backdrop-blur-sm md:flex md:items-center md:justify-center"
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
        className="flex h-[min(88vh,52rem)] w-full max-w-4xl animate-scale-in flex-col overflow-hidden rounded-2xl bg-white shadow-2xl outline-none"
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div>
            <h2 id={titleId} className="font-serif text-xl font-medium tracking-tight text-charcoal">
              Seu relato em áudio
            </h2>
            <p className="mt-0.5 text-sm text-charcoal-muted">
              Revise a transcrição e confirme o check-in com um toque.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Fechar"
            className="rounded-full p-1.5 text-charcoal-muted/70 transition-colors hover:bg-slate-100 hover:text-charcoal disabled:opacity-50"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6 scrollbar-thin">
          <ModalBody
            draft={draft}
            isSubmitting={isSubmitting}
            submitError={submitError}
            lastExtracted={lastExtracted}
          />
        </div>

        <footer className="shrink-0 border-t border-slate-100 bg-white px-6 py-4">{footer}</footer>
      </div>
    </div>,
    document.body,
  );
}
