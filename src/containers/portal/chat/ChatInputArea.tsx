import { useEffect, useRef, type FormEvent, type KeyboardEvent, type PointerEvent } from 'react';
import type { CompanionAudioState } from './useCompanionAudio';

interface ChatInputAreaProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  audioState: CompanionAudioState;
  audioDurationLabel: string;
  waveHeights: number[];
  audioError?: string | null;
  onHoldStart: () => void;
  onHoldEnd: () => void;
  onHoldCancel: () => void;
}

function MicIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}

export function ChatInputArea({
  value,
  onChange,
  onSubmit,
  disabled = false,
  audioState,
  audioDurationLabel,
  waveHeights,
  audioError,
  onHoldStart,
  onHoldEnd,
  onHoldCancel,
}: ChatInputAreaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recording = audioState === 'recording';
  const transcribing = audioState === 'transcribing';
  const inputLocked = disabled || recording || transcribing;
  const canSend = value.trim().length > 0 && !inputLocked;

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSend) return;
    onSubmit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (canSend) onSubmit();
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (inputLocked && !recording) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    onHoldStart();
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onHoldEnd();
  }

  function handlePointerCancel() {
    onHoldCancel();
  }

  return (
    <div className="shrink-0 bg-gradient-to-t from-[#F8FAF9] via-[#F8FAF9] to-transparent px-3 pb-3 pt-2 lg:px-8">
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex max-w-2xl items-end gap-2 rounded-[1.75rem] border border-slate-200/80 bg-white px-2.5 py-2 shadow-soft"
      >
        <label className="sr-only" htmlFor="companion-chat-input">
          Mensagem para a Ivy
        </label>
        <div className="relative min-w-0 flex-1">
          {recording || transcribing ? (
            <div className="flex min-h-11 items-center gap-3 px-2">
              <span className="flex h-6 items-end gap-0.5" aria-hidden>
                {waveHeights.map((height, index) => (
                  <span
                    key={index}
                    className="w-1 rounded-full bg-primary"
                    style={{ height: `${height}px` }}
                  />
                ))}
              </span>
              <span className="text-sm font-medium text-primary">
                {transcribing ? 'Transcrevendo…' : `Gravando ${audioDurationLabel}`}
              </span>
              {recording ? (
                <span className="ml-auto text-[11px] text-charcoal-muted">solte para enviar</span>
              ) : null}
            </div>
          ) : (
            <textarea
              id="companion-chat-input"
              ref={textareaRef}
              rows={1}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={handleKeyDown}
              disabled={inputLocked}
              placeholder="Pergunte alguma coisa"
              className="max-h-[8rem] min-h-11 w-full resize-none bg-transparent px-3 py-2.5 text-[15px] text-charcoal placeholder:text-charcoal-muted/60 focus:outline-none"
            />
          )}
        </div>

        {canSend ? (
          <button
            type="submit"
            className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-charcoal text-white transition-transform active:scale-[0.98]"
            aria-label="Enviar mensagem"
          >
            <SendIcon />
          </button>
        ) : (
          <button
            type="button"
            disabled={disabled || transcribing}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            className={`mb-0.5 flex h-10 w-10 shrink-0 touch-none items-center justify-center rounded-full text-white transition-transform select-none active:scale-[0.98] ${
              recording ? 'bg-error' : 'bg-charcoal'
            } disabled:opacity-50`}
            aria-label="Segurar para gravar"
          >
            <MicIcon />
          </button>
        )}
      </form>
      {audioError ? (
        <p className="mx-auto mt-2 max-w-2xl text-center text-xs text-error" role="status">
          {audioError}
        </p>
      ) : null}
    </div>
  );
}
