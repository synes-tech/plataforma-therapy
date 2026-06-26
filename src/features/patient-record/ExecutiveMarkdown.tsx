import { AiMarkdownContent } from '@shared/ui/AiMarkdownContent';

/**
 * @deprecated Use {@link AiMarkdownContent} com variant="dark".
 * Mantido para compatibilidade com painéis executivos.
 */
export function ExecutiveMarkdown({ content }: { content: string }) {
  return <AiMarkdownContent content={content} variant="dark" />;
}
