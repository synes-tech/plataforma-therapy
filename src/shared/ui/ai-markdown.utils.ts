import type { ReactNode } from 'react';
import { createElement } from 'react';

export type MarkdownBlockType = 'h1' | 'h2' | 'h3' | 'p' | 'ul' | 'ol';

export interface MarkdownBlock {
  type: MarkdownBlockType;
  text?: string;
  items?: string[];
}

const BULLET_LINE = /^[-*•]\s+/;
const ORDERED_LINE = /^\d+\.\s+/;
const HEADING_LINE = /^(#{1,3})\s+(.+)$/;
const INLINE_PATTERN = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;

function parseLineByLine(lines: string[]): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let bulletBuffer: string[] = [];
  let orderedBuffer: string[] = [];

  const flushBullets = () => {
    if (bulletBuffer.length > 0) {
      blocks.push({ type: 'ul', items: [...bulletBuffer] });
      bulletBuffer = [];
    }
  };

  const flushOrdered = () => {
    if (orderedBuffer.length > 0) {
      blocks.push({ type: 'ol', items: [...orderedBuffer] });
      orderedBuffer = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushBullets();
      flushOrdered();
      continue;
    }

    if (BULLET_LINE.test(trimmed)) {
      flushOrdered();
      bulletBuffer.push(trimmed.replace(BULLET_LINE, ''));
      continue;
    }

    if (ORDERED_LINE.test(trimmed)) {
      flushBullets();
      orderedBuffer.push(trimmed.replace(ORDERED_LINE, ''));
      continue;
    }

    flushBullets();
    flushOrdered();
    blocks.push({ type: 'p', text: trimmed });
  }

  flushBullets();
  flushOrdered();
  return blocks;
}

function parseSection(section: string): MarkdownBlock[] {
  const trimmed = section.trim();
  if (!trimmed) return [];

  const lines = trimmed.split('\n');
  const firstLine = lines[0]?.trim() ?? '';
  const headingMatch = firstLine.match(HEADING_LINE);

  if (headingMatch) {
    const level = headingMatch[1]?.length ?? 1;
    const type: MarkdownBlockType = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3';
    const blocks: MarkdownBlock[] = [{ type, text: headingMatch[2] ?? '' }];
    const rest = lines.slice(1).join('\n').trim();
    if (rest) {
      blocks.push(...parseMarkdownContent(rest));
    }
    return blocks;
  }

  const nonEmptyLines = lines.filter((line) => line.trim());
  if (nonEmptyLines.length === 0) return [];

  if (nonEmptyLines.every((line) => BULLET_LINE.test(line.trim()))) {
    return [
      {
        type: 'ul',
        items: nonEmptyLines.map((line) => line.trim().replace(BULLET_LINE, '')),
      },
    ];
  }

  if (nonEmptyLines.every((line) => ORDERED_LINE.test(line.trim()))) {
    return [
      {
        type: 'ol',
        items: nonEmptyLines.map((line) => line.trim().replace(ORDERED_LINE, '')),
      },
    ];
  }

  if (lines.length > 1) {
    const hasListLines = lines.some(
      (line) => BULLET_LINE.test(line.trim()) || ORDERED_LINE.test(line.trim()),
    );
    if (hasListLines) {
      return parseLineByLine(lines);
    }
  }

  return [{ type: 'p', text: trimmed }];
}

/** Converte Markdown clínico gerado por IA em blocos estruturados para renderização segura. */
export function parseMarkdownContent(content: string): MarkdownBlock[] {
  if (!content.trim()) return [];
  return content.split(/\n\n+/).flatMap(parseSection);
}

export interface InlineMarkdownOptions {
  strongClassName?: string;
  emClassName?: string;
  codeClassName?: string;
}

/** Formata negrito, itálico e código inline sem HTML bruto. */
export function formatInlineMarkdown(text: string, options: InlineMarkdownOptions = {}): ReactNode[] {
  if (!text) return [];

  const parts = text.split(INLINE_PATTERN);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return createElement(
        'strong',
        { key: index, className: options.strongClassName },
        part.slice(2, -2),
      );
    }

    if (part.startsWith('*') && part.endsWith('*') && part.length > 2 && !part.startsWith('**')) {
      return createElement('em', { key: index, className: options.emClassName }, part.slice(1, -1));
    }

    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return createElement('code', { key: index, className: options.codeClassName }, part.slice(1, -1));
    }

    return part;
  });
}
