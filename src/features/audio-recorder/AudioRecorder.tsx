import { useState, useRef, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Spinner } from '@containers/loading';
import { AiMarkdownContent } from '@shared/ui/AiMarkdownContent';
import { callFunction } from '@shared/lib/api';
import { blobToWav } from '@shared/lib/audio-wav';
import { fetchSessionNoteContent, useAudioJobWatcher } from './useAudioJobWatcher';
import {
  formatCaptureTime,
  useSessionAudioCapture,
} from './useSessionAudioCapture';

interface AudioRecorderProps {
  patientId: string;
  scheduleId?: string;
  recordingType: 'onboarding' | 'post_session' | 'note';
  onComplete?: (jobId: string) => void;
}

type RecordingState = 'idle' | 'recording' | 'uploading' | 'processing' | 'done' | 'error';

interface SessionNoteContent {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  summary_markdown?: string;
  transcription?: string;
}

const STEPS = [
  { id: 'record', label: 'Gravar' },
  { id: 'upload', label: 'Enviar' },
  { id: 'process', label: 'Processar' },
  { id: 'review', label: 'Revisar' },
] as const;

function MicIcon({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 003-3V4.5a3 3 0 10-6 0v8.25a3 3 0 003 3z"
      />
    </svg>
  );
}

function WaveformBars({ active }: { active: boolean }) {
  const heights = [14, 22, 18, 26, 16, 24, 20];

  return (
    <div className="flex h-10 items-end justify-center gap-1.5" aria-hidden>
      {heights.map((height, i) => (
        <div
          key={i}
          className={`w-1.5 rounded-full bg-primary transition-all ${
            active ? 'animate-pulse' : 'opacity-30'
          }`}
          style={{
            height: `${height}px`,
            animationDelay: `${i * 0.12}s`,
            animationDuration: '0.9s',
          }}
        />
      ))}
    </div>
  );
}

function stepIndex(state: RecordingState): number {
  if (state === 'idle' || state === 'error') return 0;
  if (state === 'recording') return 0;
  if (state === 'uploading') return 1;
  if (state === 'processing') return 2;
  return 3;
}

export function AudioRecorder({ patientId, scheduleId, recordingType, onComplete }: AudioRecorderProps) {
  const queryClient = useQueryClient();
  const capture = useSessionAudioCapture();
  const {
    resetCapture,
    startRecording: captureStart,
    stopRecording: captureStop,
    error: captureError,
    duration,
    isRecording: captureIsRecording,
    isPaused: captureIsPaused,
  } = capture;

  const [state, setState] = useState<RecordingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [sessionNote, setSessionNote] = useState<SessionNoteContent | null>(null);
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);
  const jobIdRef = useRef<string | null>(null);

  useEffect(() => {
    resetCapture();
    setState('idle');
    setError(null);
    setSessionNote(null);
    jobIdRef.current = null;
    setProcessingJobId(null);
  }, [patientId, scheduleId, resetCapture]);

  useEffect(() => {
    if (captureError && state === 'idle') {
      setError(captureError);
      setState('error');
    }
  }, [captureError, state]);

  const handleJobCompleted = useCallback(
    async (noteId: string) => {
      const content = await fetchSessionNoteContent(noteId);

      if (content) {
        setSessionNote(content as unknown as SessionNoteContent);
      }

      setState('done');
      onComplete?.(jobIdRef.current ?? '');
      void queryClient.invalidateQueries({ queryKey: ['session-notes-draft', patientId] });
      void queryClient.invalidateQueries({ queryKey: ['patient-sessions', patientId] });
      window.dispatchEvent(new CustomEvent('ai-job-complete', { detail: { patient_id: patientId } }));
    },
    [onComplete, patientId, queryClient],
  );

  const handleJobFailed = useCallback((reason?: 'failed' | 'timeout') => {
    setError(
      reason === 'timeout'
        ? 'O processamento está demorando mais que o esperado. Confira "Pendentes de revisão" abaixo ou tente gravar novamente.'
        : 'A IA não conseguiu processar o áudio. Tente novamente.',
    );
    setState('error');
    void queryClient.invalidateQueries({ queryKey: ['session-notes-draft', patientId] });
  }, [patientId, queryClient]);

  useAudioJobWatcher({
    active: state === 'processing',
    jobId: processingJobId,
    onCompleted: handleJobCompleted,
    onFailed: handleJobFailed,
  });

  const uploadMutation = useMutation({
    mutationFn: async (audioBlob: Blob) => {
      const response = await callFunction<{
        audio_recording_id: string;
        upload_url: string;
        job_id: string;
      }>('upload-audio', {
        patient_id: patientId,
        recording_type: recordingType,
        duration_seconds: duration,
        ...(scheduleId ? { schedule_id: scheduleId } : {}),
      });

      const wavBlob = await blobToWav(audioBlob);
      const uploadResponse = await fetch(response.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': 'audio/wav' },
        body: wavBlob,
      });

      if (!uploadResponse.ok) {
        throw new Error('Falha ao enviar o áudio. Tente novamente.');
      }

      callFunction('process-audio', {
        audio_recording_id: response.audio_recording_id,
        patient_id: patientId,
        job_id: response.job_id,
      }).catch((err) => console.error('process-audio trigger failed:', err));

      return response;
    },
    onSuccess: (data) => {
      jobIdRef.current = data.job_id;
      setProcessingJobId(data.job_id);
      setState('processing');
    },
    onError: (err: Error) => {
      setError(err.message);
      setState('error');
    },
  });

  const resetRecorder = useCallback(() => {
    resetCapture();
    setState('idle');
    setError(null);
    setSessionNote(null);
    jobIdRef.current = null;
    setProcessingJobId(null);
  }, [resetCapture]);

  const startRecording = useCallback(async () => {
    setError(null);
    setSessionNote(null);
    setState('recording');
    await captureStart();
  }, [captureStart]);

  const stopRecording = useCallback(async () => {
    if (state !== 'recording' && !captureIsRecording && !captureIsPaused) return;

    setState('uploading');
    const blob = await captureStop();
    if (!blob) {
      setError('Nenhum áudio capturado. Tente gravar novamente.');
      setState('error');
      return;
    }
    uploadMutation.mutate(blob);
  }, [captureIsPaused, captureIsRecording, captureStop, state, uploadMutation]);

  const previewText =
    sessionNote?.transcription?.trim() ||
    sessionNote?.subjective?.trim() ||
    sessionNote?.summary_markdown?.trim() ||
    null;

  const currentStep = stepIndex(state);
  const isRecordingActive = state === 'recording' || captureIsRecording || captureIsPaused;
  const isBusy = state === 'uploading' || state === 'processing';

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <header className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="session-recorder-title" className="font-display text-base font-semibold text-charcoal">
              Ditado pós-consulta
            </h2>
            <p className="mt-0.5 text-sm text-charcoal-muted">
              Fale naturalmente — a IA organiza em relatório SOAP.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
            Áudio com IA
          </span>
        </div>
      </header>

      <div className="px-5 py-5 sm:px-6 sm:py-6">
        <ol className="mb-6 grid grid-cols-4 gap-1 sm:gap-2" aria-label="Etapas da gravação">
          {STEPS.map((step, index) => {
            const done = index < currentStep;
            const active = index === currentStep;
            return (
              <li key={step.id} className="flex flex-col items-center gap-1.5 text-center">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                    done
                      ? 'bg-mint text-white'
                      : active
                        ? 'bg-primary text-white shadow-sm'
                        : 'bg-slate-100 text-charcoal-muted'
                  }`}
                >
                  {done ? '✓' : index + 1}
                </span>
                <span
                  className={`text-[10px] font-medium uppercase tracking-wide sm:text-[11px] ${
                    active ? 'text-charcoal' : 'text-charcoal-muted'
                  }`}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>

        {(error || captureError) && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-error/15 bg-error-light/60 px-4 py-3 text-sm text-error"
          >
            {error || captureError}
            <button
              type="button"
              onClick={resetRecorder}
              className="ml-2 font-medium underline underline-offset-2"
            >
              Tentar novamente
            </button>
          </div>
        )}

        <div className="rounded-2xl border border-slate-100 bg-[#F8FAF9] px-4 py-8 sm:px-8 sm:py-10">
          <div className="flex flex-col items-center gap-5">
            {(isRecordingActive || isBusy) && <WaveformBars active={isRecordingActive} />}

            {isRecordingActive && (
              <p className="font-mono text-4xl font-medium tabular-nums tracking-tight text-charcoal" aria-live="polite">
                {formatCaptureTime(duration)}
              </p>
            )}

            {state === 'uploading' && (
              <div className="flex flex-col items-center gap-2 text-center">
                <Spinner size="md" />
                <p className="text-sm font-medium text-charcoal">Enviando áudio...</p>
                <p className="text-xs text-charcoal-muted">Mantendo a conexão segura com o servidor.</p>
              </div>
            )}

            {state === 'processing' && (
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ai-50 text-ai">
                  <Spinner size="md" />
                </div>
                <p className="text-sm font-medium text-charcoal">IA transcrevendo e estruturando o relatório</p>
                <p className="max-w-xs text-xs leading-relaxed text-charcoal-muted">
                  Isso pode levar alguns segundos. Aguarde nesta tela.
                </p>
              </div>
            )}

            {state === 'done' && (
              <div className="w-full animate-fade-in text-left">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-mint-50">
                    <svg className="h-3.5 w-3.5 text-mint-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-mint-dark">Relatório pronto para revisão</span>
                </div>

                {previewText ? (
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-100 bg-white p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-charcoal-muted">Resumo</p>
                    <div className="mt-2">
                      <AiMarkdownContent content={previewText} variant="light" />
                    </div>
                  </div>
                ) : (
                  <p className="rounded-xl border border-mint-100 bg-mint-50/50 px-4 py-3 text-sm text-charcoal">
                    A transcrição foi concluída. Role até &quot;Pendentes de revisão&quot; para aprovar o relatório SOAP.
                  </p>
                )}

                <p className="mt-3 text-xs text-charcoal-muted">
                  Role até &quot;Revisão e aprovação&quot; abaixo para lapidar o texto e escolher se a
                  família poderá ver o relatório.
                </p>

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={resetRecorder}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-charcoal transition-colors hover:border-primary/30 hover:bg-primary-50"
                  >
                    Gravar nova sessão
                  </button>
                </div>
              </div>
            )}

            {state === 'idle' && (
              <>
                <button
                  type="button"
                  onClick={startRecording}
                  className="group relative flex h-24 w-24 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/25 transition-transform hover:scale-[1.03] hover:bg-primary-dark active:scale-[0.97]"
                  aria-label="Iniciar gravação"
                >
                  <span className="absolute inset-0 rounded-full bg-primary/20 opacity-0 transition-opacity group-hover:opacity-100" />
                  <MicIcon className="relative h-8 w-8" />
                </button>
                <p className="text-center text-sm font-medium text-charcoal">Toque para iniciar a gravação</p>
              </>
            )}

            {isRecordingActive && state !== 'uploading' && state !== 'processing' && (
              <>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-md ring-4 ring-error/30 transition-transform hover:scale-[1.02] active:scale-[0.97]"
                  aria-label="Parar gravação"
                >
                  <span className="absolute inset-0 animate-ping rounded-full bg-error/10" aria-hidden />
                  <div className="relative h-6 w-6 rounded-md bg-error" />
                </button>
                <p className="text-center text-sm font-medium text-charcoal">Gravando — toque para finalizar</p>
              </>
            )}
          </div>
        </div>

        {state === 'idle' && (
          <ul className="mt-5 space-y-2 text-sm text-charcoal-muted">
            <li className="flex items-start gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
              Descreva o que aconteceu na sessão, comportamentos observados e combinados com a família.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
              Não precisa ser perfeito — a IA estrutura subjetivo, objetivo, avaliação e plano.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
              Revise o relatório antes de aprovar e salvar no prontuário.
            </li>
          </ul>
        )}
      </div>
    </article>
  );
}
