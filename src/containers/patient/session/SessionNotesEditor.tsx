import { memo, useEffect, useRef } from 'react';

interface SessionNotesEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const EDITOR_CLASS =
  'min-h-[280px] w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-4 text-[15px] leading-relaxed text-charcoal shadow-inner shadow-slate-100/50 placeholder:text-slate-400 focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10 lg:min-h-[420px]';

function SessionNotesEditorComponent({
  value,
  onChange,
  disabled = false,
  placeholder = 'Digite suas observações clínicas aqui… Comportamentos, evolução, combinados com a família, plano para próxima sessão.',
}: SessionNotesEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 280)}px`;
  }, [value]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="session-notes-editor-title" className="font-display text-base font-semibold text-charcoal">
            Anotações da sessão
          </h2>
          <p className="mt-0.5 text-sm text-charcoal-muted">
            Digite livremente enquanto grava — ou use apenas texto, sem áudio.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-charcoal-muted">
          {value.trim().length > 0 ? `${value.trim().length} caracteres` : 'Pronto para digitar'}
        </span>
      </div>

      <div className="relative flex-1">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          aria-labelledby="session-notes-editor-title"
          className={EDITOR_CLASS}
          spellCheck
        />
        <div
          className="pointer-events-none absolute bottom-3 right-3 rounded-lg border border-slate-100 bg-white/90 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-charcoal-muted backdrop-blur-sm"
          aria-hidden
        >
          Markdown simples · Shift+Enter para nova linha
        </div>
      </div>
    </div>
  );
}

export const SessionNotesEditor = memo(SessionNotesEditorComponent);
