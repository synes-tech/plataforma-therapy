/**
 * Normalização e sanitização de Markdown clínico antes de persistir no banco.
 * Mantido em sync com supabase/functions/_shared/clinical-markdown-normalize.ts
 */

const HTML_TAG_PATTERN = /<[^>]*>/g;
const SCRIPT_URL_PATTERN = /javascript\s*:/gi;
const DATA_URL_PATTERN = /data\s*:\s*text\/html/gi;
const NULL_BYTE_PATTERN = /\u0000/g;

export function normalizeClinicalMarkdown(input: string): string {
  let text = input.replace(/\r\n/g, '\n').replace(NULL_BYTE_PATTERN, '');

  text = text.replace(HTML_TAG_PATTERN, '');
  text = text.replace(SCRIPT_URL_PATTERN, '');
  text = text.replace(DATA_URL_PATTERN, '');

  text = text.replace(/[ \t]+\n/g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

export type ClinicalMarkdownValidationResult =
  | { ok: true; normalized: string }
  | { ok: false; code: string; message: string };

export function validateClinicalMarkdown(
  input: string,
  maxLength = 100_000,
): ClinicalMarkdownValidationResult {
  const normalized = normalizeClinicalMarkdown(input);

  if (!normalized) {
    return { ok: false, code: 'EMPTY_CONTENT', message: 'O conteúdo não pode ficar vazio' };
  }

  if (normalized.length > maxLength) {
    return {
      ok: false,
      code: 'CONTENT_TOO_LONG',
      message: `Conteúdo excede o limite de ${maxLength} caracteres`,
    };
  }

  return { ok: true, normalized };
}
