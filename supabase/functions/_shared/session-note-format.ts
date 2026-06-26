/** Formata conteúdo SOAP/IA para exibição ou snapshot clínico (espelha frontend). */
export function formatClinicalReportText(content: Record<string, unknown>): string {
  const lapidated = typeof content.lapidated_text === 'string' ? content.lapidated_text.trim() : '';
  if (lapidated) return lapidated;

  const summary = typeof content.summary_markdown === 'string' ? content.summary_markdown.trim() : '';
  if (summary) return summary;

  const sections: Array<{ label: string; key: string }> = [
    { label: 'Subjetivo', key: 'subjective' },
    { label: 'Objetivo', key: 'objective' },
    { label: 'Avaliação', key: 'assessment' },
    { label: 'Plano', key: 'plan' },
  ];

  const parts = sections
    .map(({ label, key }) => {
      const value = typeof content[key] === 'string' ? (content[key] as string).trim() : '';
      return value ? `${label}\n${value}` : null;
    })
    .filter((part): part is string => !!part);

  if (parts.length > 0) return parts.join('\n\n');

  const transcription = typeof content.transcription === 'string' ? content.transcription.trim() : '';
  return transcription;
}
