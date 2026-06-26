import { useMemo, useState } from 'react';

interface CheckinScrollableTextProps {
  text: string;
  /** Altura máxima antes de expandir (Tailwind class). */
  collapsedMaxClass?: string;
}

function ScrollHintIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
    </svg>
  );
}

export function CheckinScrollableText({
  text,
  collapsedMaxClass = 'max-h-56',
}: CheckinScrollableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const isLong = useMemo(
    () => text.length > 240 || text.split('\n').length > 4,
    [text],
  );

  const showCollapsedScroll = isLong && !expanded;

  return (
    <div className="relative min-w-0">
      {showCollapsedScroll && (
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-primary">
          <ScrollHintIcon />
          Role para ler todo o conteúdo ou expanda abaixo
        </p>
      )}

      <div
        className={`relative rounded-lg border border-slate-200/80 bg-slate-50/50 ${
          expanded
            ? ''
            : `${collapsedMaxClass} overflow-y-auto overscroll-contain pr-1 [scrollbar-color:rgb(148_163_184)_rgb(241_245_249)] scrollbar-thin`
        }`}
      >
        <p className="break-words whitespace-pre-wrap px-3 py-3 text-sm leading-relaxed text-charcoal">
          {text}
        </p>

        {showCollapsedScroll && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-12 rounded-b-lg bg-gradient-to-t from-slate-50 via-slate-50/80 to-transparent"
            aria-hidden
          />
        )}
      </div>

      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary-50/60 px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary-50"
          aria-expanded={expanded}
        >
          {expanded ? 'Recolher texto' : 'Expandir texto completo'}
        </button>
      )}
    </div>
  );
}
