import { useEffect, useRef, type FormEvent, type KeyboardEvent } from 'react';
import { COPILOT_DISCLAIMER } from './patient-copilot.constants';
import type { CopilotAudioInputState } from './useCopilotAudioInput';

interface PatientCopilotChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  patientFirstName: string;
  disabled?: boolean;
  audioState?: CopilotAudioInputState;
  audioDurationLabel?: string;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  onCancelRecording?: () => void;
  audioError?: string | null;
}

function SendIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </svg>
  );
}

export function PatientCopilotChatInput({
  value,
  onChange,
  onSubmit,
  patientFirstName,
  disabled = false,
  audioState = 'idle',
  audioDurationLabel = '0:00',
  onStartRecording,
  onStopRecording,
  onCancelRecording,
  audioError,
}: PatientCopilotChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isRecording = audioState === 'recording';
  const isTranscribing = audioState === 'transcribing';
  const inputDisabled = disabled || isRecording || isTranscribing;

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [value]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  }

  return (
    <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-3 lg:px-6">
      <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
        {isRecording ? (
          <div
            className="flex items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50/60 px-4 py-3 shadow-sm"
            role="status"
            aria-live="polite"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="relative flex h-3 w-3 shrink-0" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-charcoal">Gravando mensagem de voz</p>
                <p className="text-xs text-charcoal-muted">{audioDurationLabel}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={onCancelRecording}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-charcoal-muted transition-colors hover:bg-white/80"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onStopRecording}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500 text-white transition-colors hover:bg-red-600"
                aria-label="Parar gravação e enviar"
              >
                <StopIcon />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-gray-50 p-2 shadow-sm">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isTranscribing
                  ? 'Transcrevendo áudio...'
                  : `Pergunte sobre ${patientFirstName}...`
              }
              rows={1}
              maxLength={2000}
              disabled={inputDisabled}
              className="max-h-32 min-h-[2.5rem] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-charcoal placeholder:text-charcoal-muted/50 focus:outline-none disabled:opacity-60"
              aria-label="Mensagem para o copiloto"
            />
            <button
              type="button"
              onClick={onStartRecording}
              disabled={inputDisabled}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-charcoal transition-colors hover:border-primary/40 hover:bg-primary-50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Gravar mensagem de voz"
              title="Gravar áudio"
            >
              {isTranscribing ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
              ) : (
                <MicIcon />
              )}
            </button>
            <button
              type="submit"
              disabled={!value.trim() || inputDisabled}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Enviar mensagem"
            >
              <SendIcon />
            </button>
          </div>
        )}

        {audioError && (
          <p className="mt-2 text-center text-xs text-red-600" role="alert">
            {audioError}
          </p>
        )}

        <p className="mt-2 text-center text-[11px] text-charcoal-muted/70">{COPILOT_DISCLAIMER}</p>
      </form>
    </div>
  );
}
