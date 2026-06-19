import { useEffect, useRef, type FormEvent, type KeyboardEvent } from 'react';
import { COPILOT_DISCLAIMER } from './patient-copilot.constants';

interface PatientCopilotChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  patientFirstName: string;
  disabled?: boolean;
}

function SendIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}

export function PatientCopilotChatInput({
  value,
  onChange,
  onSubmit,
  patientFirstName,
  disabled = false,
}: PatientCopilotChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    <div className="sticky bottom-0 shrink-0 border-t border-slate-100 bg-white/95 px-4 py-3 backdrop-blur-sm lg:px-6">
      <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
        <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-gray-50 p-2 shadow-sm">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Pergunte sobre ${patientFirstName}...`}
            rows={1}
            maxLength={2000}
            disabled={disabled}
            className="max-h-32 min-h-[2.5rem] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-charcoal placeholder:text-charcoal-muted/50 focus:outline-none disabled:opacity-60"
            aria-label="Mensagem para o copiloto"
          />
          <button
            type="submit"
            disabled={!value.trim() || disabled}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Enviar mensagem"
          >
            <SendIcon />
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-charcoal-muted/70">{COPILOT_DISCLAIMER}</p>
      </form>
    </div>
  );
}
