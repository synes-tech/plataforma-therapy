import { useRef, useState, useCallback } from 'react';
import { LoadingButton } from '@containers/loading';
import { SessionNotesEditor } from './SessionNotesEditor';
import { SessionAudioPanel, type SessionAudioPanelHandle } from './SessionAudioPanel';
import { ClinicalSessionProcessingOverlay } from './ClinicalSessionProcessingOverlay';
import { finalizeClinicalSession } from './clinical-session-payload.utils';
import { useClinicalSessionSubmit } from './useClinicalSessionSubmit';

interface ClinicalSessionWorkspaceProps {
  patientId: string;
  scheduleId?: string;
  onSessionProcessed?: (sessionNoteId: string) => void;
}

export function ClinicalSessionWorkspace({
  patientId,
  scheduleId,
  onSessionProcessed,
}: ClinicalSessionWorkspaceProps) {
  const audioPanelRef = useRef<SessionAudioPanelHandle>(null);
  const [anotacoesTexto, setAnotacoesTexto] = useState('');
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [audioSnapshot, setAudioSnapshot] = useState({ hasBlob: false, isRecording: false });

  const {
    submit,
    isBusy,
    processingLabel,
    error: submitError,
    resetError,
  } = useClinicalSessionSubmit({ patientId });

  const hasText = anotacoesTexto.trim().length > 0;
  const canFinalize = hasText || audioSnapshot.hasBlob;
  const displayError = finalizeError ?? submitError;

  const handleFinalize = useCallback(async () => {
    setFinalizeError(null);
    resetError();

    try {
      const audioBlob = await audioPanelRef.current?.stopIfRecording();
      const duration = audioPanelRef.current?.getDuration() ?? 0;

      const result = finalizeClinicalSession({
        patientId,
        scheduleId,
        anotacoesTexto,
        audioBlob,
        audioDurationSeconds: duration,
      });

      if (!result) {
        setFinalizeError('Adicione anotações em texto ou grave um áudio antes de finalizar.');
        return;
      }

      if (result.payload.input_mode === 'text' && (result.payload.anotacoes_texto?.length ?? 0) < 10) {
        setFinalizeError('As anotações textuais devem ter pelo menos 10 caracteres.');
        return;
      }

      const sessionNoteId = await submit(result.payload);

      audioPanelRef.current?.reset();
      setAnotacoesTexto('');
      setAudioSnapshot({ hasBlob: false, isRecording: false });
      onSessionProcessed?.(sessionNoteId);
    } catch {
      // Erro já tratado no hook submit
    }
  }, [anotacoesTexto, onSessionProcessed, patientId, resetError, scheduleId, submit]);

  const handleResetWorkspace = useCallback(() => {
    if (isBusy) return;
    audioPanelRef.current?.reset();
    setAnotacoesTexto('');
    setFinalizeError(null);
    resetError();
    setAudioSnapshot({ hasBlob: false, isRecording: false });
  }, [isBusy, resetError]);

  const handleCaptureChange = useCallback(
    (snapshot: { hasBlob: boolean; isRecording: boolean }) => {
      setAudioSnapshot(snapshot);
    },
    [],
  );

  return (
    <>
      <ClinicalSessionProcessingOverlay
        show={isBusy}
        label={processingLabel ?? 'Processando sessão…'}
      />

      <section
        aria-labelledby="clinical-workspace-title"
        className={`space-y-4 ${isBusy ? 'pointer-events-none opacity-60' : ''}`}
        aria-busy={isBusy}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="clinical-workspace-title" className="font-serif text-lg font-medium text-charcoal sm:text-xl">
              Workspace clínico
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-charcoal-muted">
              Grave áudio, digite anotações ou combine os dois. Ao finalizar, a IA gera o relatório para lapidação.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {hasText && (
              <span className="rounded-full bg-ai-50 px-3 py-1 text-xs font-medium text-ai">Texto</span>
            )}
            {audioSnapshot.hasBlob && (
              <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary">Áudio</span>
            )}
            {audioSnapshot.isRecording && (
              <span className="rounded-full bg-error/10 px-3 py-1 text-xs font-medium text-error">Gravando</span>
            )}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(280px,320px)_1fr] lg:gap-6">
          <SessionAudioPanel
            ref={audioPanelRef}
            disabled={isBusy}
            onCaptureChange={handleCaptureChange}
          />

          <article className="flex min-h-[480px] flex-col rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5 lg:min-h-[560px]">
            <SessionNotesEditor
              value={anotacoesTexto}
              onChange={setAnotacoesTexto}
              disabled={isBusy}
            />
          </article>
        </div>

        <div className="sticky bottom-4 z-10 rounded-2xl border border-slate-100 bg-white/95 p-4 shadow-lg backdrop-blur-sm sm:p-5">
          {displayError && (
            <p role="alert" className="mb-3 text-sm text-error">
              {displayError}
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={handleResetWorkspace}
              disabled={isBusy}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-charcoal-muted transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Limpar workspace
            </button>

            <LoadingButton
              type="button"
              onClick={handleFinalize}
              loading={isBusy}
              loadingLabel="Processando..."
              disabled={isBusy || !canFinalize}
              className="inline-flex h-12 min-w-[240px] items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-white shadow-sm hover:bg-primary-dark"
            >
              Finalizar e Processar Sessão
            </LoadingButton>
          </div>

          {!canFinalize && (
            <p className="mt-3 text-center text-xs text-charcoal-muted sm:text-right">
              Grave áudio e/ou digite anotações para habilitar o processamento.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
