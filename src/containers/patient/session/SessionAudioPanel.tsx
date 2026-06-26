import {
  forwardRef,
  useImperativeHandle,
  useCallback,
  useEffect,
} from 'react';
import {
  formatCaptureTime,
  useSessionAudioCapture,
} from '@features/audio-recorder/useSessionAudioCapture';

export interface SessionAudioPanelHandle {
  stopIfRecording: () => Promise<Blob | null>;
  getAudioBlob: () => Blob | null;
  getDuration: () => number;
  isRecording: () => boolean;
  reset: () => void;
}

interface SessionAudioPanelProps {
  disabled?: boolean;
  onCaptureChange?: (snapshot: { hasBlob: boolean; isRecording: boolean }) => void;
}

function MicIcon({ className = 'h-5 w-5' }: { className?: string }) {
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
  const heights = [10, 16, 12, 18, 11, 15, 13];

  return (
    <div className="flex h-8 items-end justify-center gap-1" aria-hidden>
      {heights.map((height, index) => (
        <div
          key={index}
          className={`w-1 rounded-full bg-primary transition-all ${active ? 'animate-pulse' : 'opacity-30'}`}
          style={{
            height: `${height}px`,
            animationDelay: `${index * 0.1}s`,
            animationDuration: '0.85s',
          }}
        />
      ))}
    </div>
  );
}

export const SessionAudioPanel = forwardRef<SessionAudioPanelHandle, SessionAudioPanelProps>(
  function SessionAudioPanel({ disabled = false, onCaptureChange }, ref) {
    const capture = useSessionAudioCapture();

    useEffect(() => {
      onCaptureChange?.({
        hasBlob: !!capture.audioBlob,
        isRecording: capture.isRecording || capture.isPaused,
      });
    }, [capture.audioBlob, capture.isRecording, capture.isPaused, onCaptureChange]);

    useImperativeHandle(
      ref,
      () => ({
        stopIfRecording: async () => {
          if (capture.isRecording || capture.isPaused) {
            return capture.stopRecording();
          }
          return capture.audioBlob;
        },
        getAudioBlob: () => capture.audioBlob,
        getDuration: () => capture.duration,
        isRecording: () => capture.isRecording || capture.isPaused,
        reset: () => capture.resetCapture(),
      }),
      [capture],
    );

    const handleStart = useCallback(async () => {
      if (disabled) return;
      await capture.startRecording();
    }, [capture, disabled]);

    const handleStop = useCallback(async () => {
      await capture.stopRecording();
    }, [capture]);

    const isActive = capture.isRecording || capture.isPaused;
    const hasRecording = !!capture.audioBlob;

    return (
      <aside
        className="flex flex-col rounded-2xl border border-slate-100 bg-white shadow-sm lg:sticky lg:top-6"
        aria-labelledby="session-audio-panel-title"
      >
        <header className="border-b border-slate-100 px-4 py-3 sm:px-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 id="session-audio-panel-title" className="font-display text-sm font-semibold text-charcoal">
                Gravação de áudio
              </h2>
              <p className="mt-0.5 text-xs text-charcoal-muted">
                Pode gravar e digitar ao mesmo tempo.
              </p>
            </div>
            {isActive && (
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-error/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-error">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-error" aria-hidden />
                REC
              </span>
            )}
          </div>
        </header>

        <div className="flex flex-1 flex-col items-center px-4 py-5 sm:px-5">
          {capture.error && (
            <div role="alert" className="mb-4 w-full rounded-xl border border-error/15 bg-error-light/60 px-3 py-2 text-xs text-error">
              {capture.error}
            </div>
          )}

          <div className="mb-4 w-full rounded-xl border border-slate-100 bg-[#F8FAF9] px-3 py-4">
            {(isActive || hasRecording) && <WaveformBars active={isActive} />}

            {(isActive || hasRecording) && (
              <p
                className="mt-3 text-center font-mono text-3xl font-medium tabular-nums tracking-tight text-charcoal"
                aria-live="polite"
              >
                {formatCaptureTime(capture.duration)}
              </p>
            )}

            {!isActive && !hasRecording && (
              <p className="text-center text-xs leading-relaxed text-charcoal-muted">
                Microfone pronto. Inicie quando quiser — o editor continua disponível.
              </p>
            )}

            {hasRecording && !isActive && (
              <p className="mt-2 text-center text-xs font-medium text-mint-dark">
                Áudio capturado ({Math.round((capture.audioBlob?.size ?? 0) / 1024)} KB)
              </p>
            )}
          </div>

          <div className="flex w-full flex-col gap-2">
            {!isActive && !hasRecording && (
              <button
                type="button"
                onClick={handleStart}
                disabled={disabled}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                <MicIcon />
                Iniciar gravação
              </button>
            )}

            {isActive && (
              <div className="grid grid-cols-2 gap-2">
                {capture.isRecording ? (
                  <button
                    type="button"
                    onClick={capture.pauseRecording}
                    disabled={disabled}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-medium text-charcoal hover:bg-slate-50"
                  >
                    Pausar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={capture.resumeRecording}
                    disabled={disabled}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-medium text-charcoal hover:bg-slate-50"
                  >
                    Retomar
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleStop}
                  disabled={disabled}
                  className="inline-flex h-11 items-center justify-center rounded-xl bg-error text-sm font-medium text-white hover:bg-error/90"
                >
                  Parar
                </button>
              </div>
            )}

            {hasRecording && !isActive && (
              <button
                type="button"
                onClick={capture.resetCapture}
                disabled={disabled}
                className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-xs font-medium text-charcoal-muted hover:bg-slate-50"
              >
                Descartar áudio
              </button>
            )}
          </div>
        </div>
      </aside>
    );
  },
);
