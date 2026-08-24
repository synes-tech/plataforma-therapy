const PSYCH_SECTIONS: Array<{ label: string; key: string; legacyKey: string; emptyFallback: string }> = [
  {
    label: 'Síntese da Sessão',
    key: 'clinical_synthesis',
    legacyKey: 'objective',
    emptyFallback: 'Não relatado nesta sessão.',
  },
  {
    label: 'Relatos e Conteúdo Trazido',
    key: 'patient_reports',
    legacyKey: 'subjective',
    emptyFallback:
      'Durante a sessão, não foram trazidos relatos ou conteúdos verbais suficientes para este bloco.',
  },
  {
    label: 'Observações e Hipóteses',
    key: 'clinical_observations',
    legacyKey: 'assessment',
    emptyFallback:
      'Durante a sessão, o terapeuta não trouxe observações ou hipóteses clínicas explícitas.',
  },
  {
    label: 'Manejo e Próximos Passos',
    key: 'management_next_steps',
    legacyKey: 'plan',
    emptyFallback:
      'Durante a sessão, não foram registrados manejo ou próximos passos explícitos.',
  },
];

function textField(content: Record<string, unknown>, key: string): string {
  const value = content[key];
  return typeof value === 'string' ? value.trim() : '';
}

/** Formata conteúdo SOAP/IA para snapshot clínico e documento salvo (espelha frontend). */
export function formatClinicalReportText(content: Record<string, unknown>): string {
  const clinicalRaw = textField(content, 'clinical_raw_text');
  if (clinicalRaw) return clinicalRaw;

  const lapidated = textField(content, 'lapidated_text');
  if (lapidated) return lapidated;

  const summary = textField(content, 'summary_markdown');
  if (summary) return summary;

  const filled = PSYCH_SECTIONS.map((section) => {
    const value = textField(content, section.key) || textField(content, section.legacyKey);
    return { ...section, value };
  });

  if (filled.some((section) => section.value)) {
    return filled
      .map((section) => `## ${section.label}\n${section.value || section.emptyFallback}`)
      .join('\n\n');
  }

  return textField(content, 'transcription');
}
