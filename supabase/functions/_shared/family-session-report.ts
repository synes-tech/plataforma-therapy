/** Extrai texto seguro para família a partir do content da nota de sessão. */
export function extractFamilyReportText(content: unknown): string {
  if (!content || typeof content !== 'object') return '';
  const obj = content as Record<string, unknown>;
  const familyText = obj.family_text;
  if (typeof familyText === 'string' && familyText.trim()) return familyText.trim();
  return '';
}

export function buildFamilyReportPreview(text: string, max = 120): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'Relatório compartilhado pelo terapeuta';
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max).trim()}…`;
}
