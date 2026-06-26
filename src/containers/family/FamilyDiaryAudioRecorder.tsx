import { useState, useRef, useCallback, useEffect } from 'react';
import { Spinner } from '@containers/loading';
import { callFunction } from '@shared/lib/api';
import { pickRecorderMime } from '@shared/lib/audio-wav';

const MAX_DURATION_SEC = 180;

export interface FamilyAudioResult {
  transcricao: string;
  audioUrl: string;
}

interface FamilyDiaryAudioRecorderProps {
  patientId: string;
  onTranscription: (result: FamilyAudioResult) => void;
  disabled?: boolean;
  /** Destaque como opção principal do check-in */
  prominent?: boolean;
  className?: string;
}

type RecorderState = 'idle' | 'recording' | 'preview' | 'uploading' | 'transcribing' | 'error';

function normalizeMime(mime: string): 'audio/webm' | 'audio/mp4' | 'audio/mpeg' | 'audio/wav' | 'audio/ogg' {
  if (mime.includes('webm')) return 'audio/webm';
  if (mime.includes('mp4') || mime.includes('aac')) return 'audio/mp4';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'audio/mpeg';
  if (mime.includes('wav')) return 'audio/wav';
  if (mime.includes('ogg')) return 'audio/ogg';
  return 'audio/webm';
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function networkErrorMessage(): string {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'Sem conexão com a internet. Verifique o Wi-Fi ou dados móveis e tente novamente.';
  }
  return 'Falha ao enviar o áudio. Verifique sua conexão e tente novamente.';
}

export function FamilyDiaryAudioRecorder({
  patientId,
  onTranscription,
  disabled = false,
  prominent = false,
  className = '',
}: FamilyDiaryAudioRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle');
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [waveHeights, setWaveHeights] = useState([8, 14, 20, 14, 8]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const waveTimerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordedMimeRef = useRef('audio/webm');
  const durationRef = useRef(0);

  const cleanupStream = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (waveTimerRef.current) {
      clearInterval(waveTimerRef.current);
      waveTimerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => cleanupStream(), [cleanupStream]);

  useEffect(() => {
    if (state !== 'recording') return;
    waveTimerRef.current = window.setInterval(() => {
      setWaveHeights((prev) =>
        prev.map((h) => {
          const delta = (Math.random() - 0.5) * 12;
          return Math.min(28, Math.max(6, h + delta));
        }),
      );
    }, 120);
    return () => {
      if (waveTimerRef.current) clearInterval(waveTimerRef.current);
    };
  }, [state]);

  const reset = useCallback(() => {
    cleanupStream();
    chunksRef.current = [];
    setDuration(0);
    durationRef.current = 0;
    setError(null);
    setState('idle');
  }, [cleanupStream]);

  const startRecording = useCallback(async () => {
    if (disabled) return;
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorderMime = pickRecorderMime();
      recordedMimeRef.current = recorderMime ?? 'audio/webm';
      const mediaRecorder = new MediaRecorder(
        stream,
        recorderMime ? { mimeType: recorderMime } : undefined,
      );
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        cleanupStream();
        setState('preview');
      };

      mediaRecorder.start(500);
      setState('recording');
      setDuration(0);
      durationRef.current = 0;

      timerRef.current = window.setInterval(() => {
        durationRef.current += 1;
        setDuration((d) => {
          const next = d + 1;
          if (next >= MAX_DURATION_SEC) {
            mediaRecorderRef.current?.stop();
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setError(
          'Precisamos do microfone para gravar seu relato. Ative a permissão nas configurações do navegador e tente de novo.',
        );
      } else if (name === 'NotFoundError') {
        setError('Nenhum microfone encontrado neste dispositivo.');
      } else {
        setError('Não foi possível iniciar a gravação. Tente novamente.');
      }
      setState('error');
    }
  }, [cleanupStream, disabled]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, [state]);

  const uploadAndTranscribe = useCallback(async () => {
    const blob = new Blob(chunksRef.current, { type: recordedMimeRef.current });
    if (blob.size === 0) {
      setError('Gravação vazia. Tente gravar novamente.');
      setState('error');
      return;
    }

    if (!navigator.onLine) {
      setError(networkErrorMessage());
      setState('error');
      return;
    }

    setState('uploading');

    try {
      const mimeType = normalizeMime(recordedMimeRef.current);

      const initiate = await callFunction<{
        upload_url: string;
        storage_path: string;
        mime_type: string;
      }>('process-family-audio', {
        step: 'initiate',
        patient_id: patientId,
        mime_type: mimeType,
        duration_seconds: durationRef.current,
      });

      const uploadRes = await fetch(initiate.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': mimeType },
        body: blob,
      });

      if (!uploadRes.ok) {
        throw new Error('upload_failed');
      }

      setState('transcribing');

      const complete = await callFunction<{
        transcricao: string;
        audio_url: string;
      }>('process-family-audio', {
        step: 'complete',
        patient_id: patientId,
        storage_path: initiate.storage_path,
        mime_type: mimeType,
        duration_seconds: durationRef.current,
      });

      onTranscription({
        transcricao: complete.transcricao,
        audioUrl: complete.audio_url,
      });
      reset();
    } catch {
      setError(networkErrorMessage());
      setState('error');
    }
  }, [onTranscription, patientId, reset]);

  const isBusy = state === 'uploading' || state === 'transcribing';

  return (
    <section
      className={`w-full rounded-2xl border p-4 shadow-soft sm:p-5 ${
        prominent
          ? 'border-primary/25 bg-gradient-to-b from-primary-50/50 to-white'
          : 'border-slate-200/80 bg-white'
      } ${className}`.trim()}
      aria-label="Gravação de áudio do check-in"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-charcoal sm:text-base">
              {prominent ? 'Grave seu check-in em áudio' : 'Relatar o dia em áudio'}
            </h4>
            {prominent ? (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                Recomendado
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-charcoal-muted sm:text-sm">
            Toque no microfone e conte como foi o momento. A transcrição aparece abaixo para você revisar antes de
            registrar.
          </p>
        </div>
        {state === 'recording' && (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-error-light/60 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-error">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-error" />
            Gravando
          </span>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-error/15 bg-error-light/40 px-3 py-2.5 text-sm text-error"
        >
          {error}
          <button
            type="button"
            onClick={reset}
            className="ml-2 font-medium underline underline-offset-2"
          >
            Tentar novamente
          </button>
        </div>
      )}

      <div className="flex flex-col items-center gap-4 py-2">
        {state === 'recording' && (
          <div className="flex h-10 items-end justify-center gap-1" aria-hidden>
            {waveHeights.map((h, i) => (
              <div
                key={i}
                className="w-1.5 rounded-full bg-primary transition-all duration-150 ease-out"
                style={{ height: `${h}px` }}
              />
            ))}
          </div>
        )}

        {(state === 'recording' || isBusy) && (
          <p className="font-mono text-2xl tabular-nums text-charcoal" aria-live="polite">
            {formatTime(duration)}
          </p>
        )}

        {state === 'preview' && (
          <p className="text-sm text-charcoal-muted">
            Gravação pronta ({formatTime(duration)}). Enviar para transcrição?
          </p>
        )}

        {state === 'uploading' && (
          <p className="text-sm text-charcoal-muted">Enviando áudio com segurança…</p>
        )}

        {state === 'transcribing' && (
          <div className="text-center">
            <Spinner size="md" className="mx-auto mb-2" />
            <p className="text-sm text-charcoal">Transcrevendo seu relato…</p>
            <p className="mt-1 text-xs text-charcoal-muted">Isso leva alguns segundos</p>
          </div>
        )}

        {state === 'idle' && (
          <button
            type="button"
            onClick={startRecording}
            disabled={disabled}
            className={`flex items-center justify-center rounded-full bg-primary text-white shadow-md transition-transform hover:bg-primary-dark active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
              prominent ? 'h-20 w-20 sm:h-24 sm:w-24' : 'h-[4.5rem] w-[4.5rem]'
            }`}
            aria-label="Iniciar gravação de áudio"
          >
            <svg
              className={prominent ? 'h-9 w-9 sm:h-10 sm:w-10' : 'h-7 w-7'}
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
            >
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          </button>
        )}

        {state === 'recording' && (
          <div className="flex w-full max-w-xs items-center justify-center gap-4">
            <button
              type="button"
              onClick={reset}
              className="min-h-[44px] flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-charcoal-muted transition-colors hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={stopRecording}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-error text-white shadow-md ring-4 ring-error/20 transition-transform active:scale-95"
              aria-label="Parar gravação"
            >
              <div className="h-5 w-5 rounded-sm bg-white" />
            </button>
          </div>
        )}

        {state === 'preview' && (
          <div className="flex w-full max-w-sm gap-3">
            <button
              type="button"
              onClick={reset}
              className="min-h-[48px] flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-charcoal-muted"
            >
              Descartar
            </button>
            <button
              type="button"
              onClick={uploadAndTranscribe}
              className="min-h-[48px] flex-1 rounded-xl bg-charcoal px-4 py-3 text-sm font-medium text-white shadow-sm active:scale-[0.98]"
            >
              Transcrever
            </button>
          </div>
        )}
      </div>

      {state === 'idle' && !error && (
        <p className="text-center text-[10px] text-charcoal-muted/70">
          Máximo {MAX_DURATION_SEC / 60} minutos · toque no microfone para começar
        </p>
      )}
    </section>
  );
}
