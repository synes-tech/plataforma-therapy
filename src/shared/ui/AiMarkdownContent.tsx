import type { ReactNode } from 'react';
import {
  formatInlineMarkdown,
  parseMarkdownContent,
  type MarkdownBlock,
} from './ai-markdown.utils';

export type AiMarkdownVariant = 'light' | 'dark' | 'compact';

interface AiMarkdownContentProps {
  content: string;
  variant?: AiMarkdownVariant;
  className?: string;
}

interface VariantStyles {
  container: string;
  blockGap: string;
  h1: string;
  h2: string;
  h3: string;
  p: string;
  ul: string;
  ol: string;
  li: string;
  bullet: string;
  strong: string;
  em: string;
  code: string;
}

const VARIANT_STYLES: Record<AiMarkdownVariant, VariantStyles> = {
  light: {
    container: 'text-sm leading-relaxed text-charcoal',
    blockGap: 'space-y-3',
    h1: 'font-serif text-lg font-medium text-charcoal',
    h2: 'font-display text-xs font-semibold uppercase tracking-wide text-primary',
    h3: 'text-sm font-semibold text-charcoal',
    p: 'text-sm leading-relaxed text-charcoal',
    ul: 'space-y-1.5 pl-1',
    ol: 'list-decimal space-y-1.5 pl-5',
    li: 'flex gap-2 text-sm leading-relaxed text-charcoal',
    bullet:
      'mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_4px_rgba(77,163,237,0.5)]',
    strong: 'font-semibold text-charcoal',
    em: 'italic text-charcoal-muted',
    code: 'rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] text-charcoal',
  },
  dark: {
    container: 'text-sm leading-relaxed text-slate-200',
    blockGap: 'space-y-4',
    h1: 'font-serif text-base font-medium text-white',
    h2: 'font-display text-xs font-semibold uppercase tracking-widest text-ai-light',
    h3: 'text-sm font-semibold text-white',
    p: 'text-slate-300',
    ul: 'space-y-2 pl-1',
    ol: 'list-decimal space-y-2 pl-5 text-slate-300',
    li: 'flex gap-2 text-slate-300',
    bullet:
      'mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary-light shadow-[0_0_6px_rgba(77,163,237,0.8)]',
    strong: 'font-medium text-white',
    em: 'italic text-slate-200',
    code: 'rounded bg-white/10 px-1 py-0.5 font-mono text-[0.85em] text-ai-light',
  },
  compact: {
    container: 'text-sm leading-relaxed text-gray-700',
    blockGap: 'space-y-2',
    h1: 'font-serif text-base font-medium text-charcoal',
    h2: 'text-xs font-semibold uppercase tracking-wide text-primary',
    h3: 'text-sm font-semibold text-charcoal',
    p: 'text-sm leading-relaxed text-gray-700',
    ul: 'space-y-1 pl-1',
    ol: 'list-decimal space-y-1 pl-4',
    li: 'flex gap-2 text-sm text-gray-700',
    bullet: 'mt-2 h-1 w-1 shrink-0 rounded-full bg-primary/70',
    strong: 'font-semibold text-charcoal',
    em: 'italic text-gray-600',
    code: 'rounded bg-slate-100 px-1 font-mono text-[0.85em]',
  },
};

/**
 * Renderização canônica de Markdown gerado por IA na plataforma.
 * Sem dependências externas — conteúdo convertido em nós React (sem HTML bruto).
 */
export function AiMarkdownContent({
  content,
  variant = 'light',
  className = '',
}: AiMarkdownContentProps) {
  const styles = VARIANT_STYLES[variant];
  const blocks = parseMarkdownContent(content);

  if (blocks.length === 0) {
    return null;
  }

  const inlineOptions = {
    strongClassName: styles.strong,
    emClassName: styles.em,
    codeClassName: styles.code,
  };

  return (
    <div className={`${styles.container} ${styles.blockGap} ${className}`.trim()}>
      {blocks.map((block, index) => renderBlock(block, index, styles, inlineOptions))}
    </div>
  );
}

function renderBlock(
  block: MarkdownBlock,
  index: number,
  styles: VariantStyles,
  inlineOptions: Parameters<typeof formatInlineMarkdown>[1],
): ReactNode {
  switch (block.type) {
    case 'h1':
      return (
        <h2 key={index} className={styles.h1}>
          {formatInlineMarkdown(block.text ?? '', inlineOptions)}
        </h2>
      );
    case 'h2':
      return (
        <h3 key={index} className={`${styles.h2} ${index > 0 ? 'mt-1' : ''}`.trim()}>
          {formatInlineMarkdown(block.text ?? '', inlineOptions)}
        </h3>
      );
    case 'h3':
      return (
        <h4 key={index} className={`${styles.h3} ${index > 0 ? 'mt-0.5' : ''}`.trim()}>
          {formatInlineMarkdown(block.text ?? '', inlineOptions)}
        </h4>
      );
    case 'ul':
      return (
        <ul key={index} className={styles.ul}>
          {(block.items ?? []).map((item, itemIndex) => (
            <li key={itemIndex} className={styles.li}>
              <span className={styles.bullet} aria-hidden />
              <span>{formatInlineMarkdown(item, inlineOptions)}</span>
            </li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol key={index} className={styles.ol}>
          {(block.items ?? []).map((item, itemIndex) => (
            <li key={itemIndex} className="leading-relaxed">
              {formatInlineMarkdown(item, inlineOptions)}
            </li>
          ))}
        </ol>
      );
    case 'p':
    default:
      return (
        <p key={index} className={styles.p}>
          {formatInlineMarkdown(block.text ?? '', inlineOptions)}
        </p>
      );
  }
}
