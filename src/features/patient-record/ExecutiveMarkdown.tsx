import type { ReactNode } from 'react';

/**
 * Renderização leve de Markdown clínico (## títulos, listas, negrito).
 * Sem dependências externas — seguro para conteúdo gerado por IA.
 */
export function ExecutiveMarkdown({ content }: { content: string }) {
  const blocks = content.split(/\n\n+/);

  return (
    <div className="space-y-4 text-sm leading-relaxed text-slate-200">
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={i} className="font-display text-xs font-semibold uppercase tracking-widest text-ai-light">
              {trimmed.replace(/^##\s+/, '')}
            </h3>
          );
        }

        if (trimmed.startsWith('# ')) {
          return (
            <h2 key={i} className="font-serif text-base font-medium text-white">
              {trimmed.replace(/^#\s+/, '')}
            </h2>
          );
        }

        const lines = trimmed.split('\n');
        const isList = lines.every((l) => /^[-*•]\s/.test(l.trim()) || l.trim() === '');

        if (isList) {
          return (
            <ul key={i} className="space-y-2 pl-1">
              {lines.filter((l) => l.trim()).map((line, j) => (
                <li key={j} className="flex gap-2 text-slate-300">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary-light shadow-[0_0_6px_rgba(77,163,237,0.8)]" />
                  <span>{formatInline(line.replace(/^[-*•]\s+/, ''))}</span>
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={i} className="text-slate-300">
            {formatInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

function formatInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-medium text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}
