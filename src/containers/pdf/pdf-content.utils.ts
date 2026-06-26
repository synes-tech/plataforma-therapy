import { parseMarkdownContent, type MarkdownBlock } from '@shared/ui/ai-markdown.utils';
import type { PdfProfessionalContext, PdfTextBlock } from './pdf-types';

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /\[Seu Nome e Credenciais\]/gi,
  /\[Nome e Credenciais\]/gi,
  /\[Suas Credenciais\]/gi,
  /\[Seu Nome\]/gi,
  /\[Nome do Terapeuta\]/gi,
  /\[Nome do Profissional\]/gi,
  /\[Nome e Registro\]/gi,
  /\[CRP\]/gi,
  /\[Registro Profissional\]/gi,
];

/** Linha de assinatura profissional para documentos e substituição de placeholders da IA. */
export function formatProfessionalSignature(professional: PdfProfessionalContext): string {
  const parts: string[] = [professional.name.trim()];

  if (professional.crp?.trim()) {
    parts.push(professional.crp.trim());
  } else if (professional.specialty?.trim()) {
    parts.push(professional.specialty.trim());
  }

  return parts.join(' · ');
}

/** Substitui placeholders estáticos gerados pela IA pelos dados reais do terapeuta logado. */
export function injectProfessionalPlaceholders(
  text: string,
  professional: PdfProfessionalContext,
): string {
  const signature = formatProfessionalSignature(professional);
  let result = text;

  for (const pattern of PLACEHOLDER_PATTERNS) {
    result = result.replace(pattern, signature);
  }

  return result;
}

export function injectProfessionalPlaceholdersInBlocks(
  blocks: PdfTextBlock[],
  professional: PdfProfessionalContext,
): PdfTextBlock[] {
  return blocks.map((block) => {
    if (block.type === 'ul' || block.type === 'ol') {
      return {
        ...block,
        items: block.items.map((item) => injectProfessionalPlaceholders(item, professional)),
      };
    }

    return {
      ...block,
      text: injectProfessionalPlaceholders(block.text, professional),
    };
  });
}

function markdownBlockToPdfBlock(block: MarkdownBlock): PdfTextBlock {
  switch (block.type) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'p':
      return { type: block.type, text: block.text ?? '' };
    case 'ul':
      return { type: 'ul', items: block.items ?? [] };
    case 'ol':
      return { type: 'ol', items: block.items ?? [] };
  }
}

/**
 * Converte Markdown clínico (mesmo parser da UI) em blocos estruturados para PDF.
 * Suporta #/##/###, listas, negrito/itálico/código inline.
 */
export function markdownToPdfBlocks(markdown: string): PdfTextBlock[] {
  if (!markdown.trim()) return [];
  return parseMarkdownContent(markdown).map(markdownBlockToPdfBlock);
}

export function paragraphsToPdfBlocks(paragraphs: string[]): PdfTextBlock[] {
  return paragraphs.flatMap((paragraph) => markdownToPdfBlocks(paragraph));
}

export function formatGender(gender: string): string {
  const map: Record<string, string> = {
    male: 'Masculino',
    female: 'Feminino',
    other: 'Outro',
    not_informed: 'Não informado',
  };
  return map[gender] ?? gender;
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone?.trim()) return 'Não informado';
  return phone.trim();
}

export function calcAge(birthDate: string): number {
  return Math.floor(
    (Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000),
  );
}

export function sanitizeFilename(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'documento'
  );
}

export function formatPdfDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
}
