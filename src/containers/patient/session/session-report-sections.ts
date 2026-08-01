/** Blocos do prontuário psicológico pós-sessão (substitui SOAP). */
export const PSYCH_REPORT_SECTIONS = [
  {
    key: 'clinical_synthesis',
    legacyKey: 'objective',
    label: 'Síntese da Sessão',
    emptyFallback: 'Não relatado nesta sessão.',
  },
  {
    key: 'patient_reports',
    legacyKey: 'subjective',
    label: 'Relatos e Conteúdo Trazido',
    emptyFallback:
      'Durante a sessão, não foram trazidos relatos ou conteúdos verbais suficientes para este bloco.',
  },
  {
    key: 'clinical_observations',
    legacyKey: 'assessment',
    label: 'Observações e Hipóteses',
    emptyFallback:
      'Durante a sessão, o terapeuta não trouxe observações ou hipóteses clínicas explícitas.',
  },
  {
    key: 'management_next_steps',
    legacyKey: 'plan',
    label: 'Manejo e Próximos Passos',
    emptyFallback:
      'Durante a sessão, não foram registrados manejo ou próximos passos explícitos.',
  },
] as const;

export type PsychReportSectionKey = (typeof PSYCH_REPORT_SECTIONS)[number]['key'];
export type LegacySoapSectionKey = (typeof PSYCH_REPORT_SECTIONS)[number]['legacyKey'];

export interface SessionReportContentFields {
  clinical_synthesis?: string;
  patient_reports?: string;
  clinical_observations?: string;
  management_next_steps?: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  summary_markdown?: string;
  clinical_raw_text?: string;
  lapidated_text?: string;
  family_text?: string;
  transcription?: string;
}

export function getReportSectionValue(
  content: SessionReportContentFields,
  section: (typeof PSYCH_REPORT_SECTIONS)[number],
): string {
  const primary = content[section.key]?.trim();
  if (primary) return primary;
  return content[section.legacyKey]?.trim() ?? '';
}
