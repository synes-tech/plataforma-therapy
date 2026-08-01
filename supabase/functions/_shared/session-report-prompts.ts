export type SessionInputMode = 'audio' | 'text' | 'dual';

/** Prontuário psicológico pós-sessão (substitui SOAP). */
export interface StructuredSessionReport {
  transcription: string;
  clinical_synthesis: string;
  patient_reports: string;
  clinical_observations: string;
  management_next_steps: string;
  summary_markdown?: string;
  /** Campos legado SOAP — preenchidos por compatibilidade de leitura/embeddings. */
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
}

export const PSYCH_REPORT_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    transcription: { type: 'STRING' },
    clinical_synthesis: { type: 'STRING' },
    patient_reports: { type: 'STRING' },
    clinical_observations: { type: 'STRING' },
    management_next_steps: { type: 'STRING' },
    summary_markdown: { type: 'STRING' },
  },
  required: [
    'transcription',
    'clinical_synthesis',
    'patient_reports',
    'clinical_observations',
    'management_next_steps',
    'summary_markdown',
  ],
  propertyOrdering: [
    'transcription',
    'clinical_synthesis',
    'patient_reports',
    'clinical_observations',
    'management_next_steps',
    'summary_markdown',
  ],
};

/** @deprecated Use PSYCH_REPORT_RESPONSE_SCHEMA */
export const SOAP_RESPONSE_SCHEMA = PSYCH_REPORT_RESPONSE_SCHEMA;

const SECTION_TITLES = {
  synthesis: 'Síntese da Sessão',
  reports: 'Relatos e Conteúdo Trazido',
  observations: 'Observações e Hipóteses',
  management: 'Manejo e Próximos Passos',
} as const;

const CORE_RULES = `
REGRAS DE FIDELIDADE (obrigatórias):
- Extraia apenas o que estiver explícito ou claramente implícito nas fontes. NÃO invente fatos, diagnósticos, medicações ou planos.
- Tom narrativo, profissional e empático — saúde mental / psicologia clínica. NÃO use rótulos médicos SOAP (Subjetivo/Objetivo/Avaliação/Plano).
- Se a fonte for curta, seja conciso. Não "encha linguiça".
- Não sugira medicações, dosagens ou diagnósticos novos.

BLOCOS (preencha todos):

1) clinical_synthesis — "${SECTION_TITLES.synthesis}"
   Um parágrafo único (máximo 3 linhas) com o tema central / foco da sessão.

2) patient_reports — "${SECTION_TITLES.reports}"
   O que o paciente (ou família, se mencionado) verbalizou de mais importante: dores, sentimentos, situações.
   Agrupe em prosa fluida; não faça lista de compras. Se não houver relatos, escreva exatamente:
   "Durante a sessão, não foram trazidos relatos ou conteúdos verbais suficientes para este bloco."

3) clinical_observations — "${SECTION_TITLES.observations}"
   Leitura clínica. REGRA DE ATRIBUIÇÃO (crítica):
   a) Se o TERAPEUTA trouxe observações, hipóteses, bloqueios ou leitura emocional na fonte, descreva-as e deixe claro que são do terapeuta (ex.: "O terapeuta observou...").
   b) Se o terapeuta NÃO trouxe observações/hipóteses, comece obrigatoriamente com:
      "Durante a sessão, o terapeuta não trouxe observações ou hipóteses clínicas explícitas."
      Em seguida, como especialista virtual em psicologia, acrescente suas próprias leituras, sempre rotuladas como da IA, por exemplo:
      "Observação da IA (especialista virtual): ..."
   Nunca misture as duas vozes sem deixar a autoria explícita.

4) management_next_steps — "${SECTION_TITLES.management}"
   O que foi feito/orientado na sessão e o plano sugerido para os próximos encontros.
   Se não houver manejo ou próximos passos na fonte, escreva exatamente:
   "Durante a sessão, não foram registrados manejo ou próximos passos explícitos."

summary_markdown — Markdown de exibição com EXATAMENTE estes títulos ## (nesta ordem):
## ${SECTION_TITLES.synthesis}
(parágrafo)
## ${SECTION_TITLES.reports}
(parágrafo)
## ${SECTION_TITLES.observations}
(parágrafo)
## ${SECTION_TITLES.management}
(parágrafo)

Responda APENAS no JSON do schema fornecido.`;

export function resolveSessionInputMode(hasAudio: boolean, hasText: boolean): SessionInputMode {
  if (hasAudio && hasText) return 'dual';
  if (hasAudio) return 'audio';
  return 'text';
}

export function buildAudioSoapPrompt(annotations?: string | null): string {
  if (annotations?.trim()) {
    return `Você é um especialista virtual em psicologia clínica, focado em terapia infantil (TEA e TDAH).
Você recebeu o ÁUDIO de uma sessão ditada pelo terapeuta E anotações textuais complementares digitadas ao vivo.

ANOTAÇÕES TEXTUAIS DO TERAPEUTA (complemento — integre com o áudio):
"""
${annotations.trim()}
"""

Tarefas:
1. Transcreva o áudio fielmente em português brasileiro (campo "transcription") — texto integral do áudio.
2. Estruture o prontuário psicológico nos 4 blocos definidos, mesclando áudio + anotações quando relevante.
3. Use as anotações para enriquecer contexto clínico que o áudio não deixou explícito.
4. Gere "summary_markdown" unificado em Markdown limpo.
${CORE_RULES}`;
  }

  return `Você é um especialista virtual em psicologia clínica, focado em terapia infantil (TEA e TDAH).
Você recebeu o ÁUDIO de uma sessão ditada pelo terapeuta.

Tarefas:
1. Transcreva o áudio fielmente em português brasileiro (campo "transcription") — texto integral, sem resumir.
2. Estruture o prontuário psicológico nos 4 blocos definidos (síntese, relatos, observações/hipóteses, manejo).
3. Gere "summary_markdown" em Markdown limpo para exibição e exportação PDF.
${CORE_RULES}`;
}

export function buildTextOnlySoapPrompt(annotations: string): string {
  return `Você é um especialista virtual em psicologia clínica, focado em terapia infantil (TEA e TDAH).
O terapeuta registrou a sessão APENAS por anotações textuais (sem áudio).

ANOTAÇÕES TEXTUAIS DO TERAPEUTA:
"""
${annotations.trim()}
"""

Tarefas:
1. No campo "transcription", reproduza fielmente as anotações textuais (ou uma consolidação literal delas).
2. Estruture o prontuário psicológico nos 4 blocos com base exclusivamente nessas anotações.
3. Gere "summary_markdown" em Markdown limpo.
${CORE_RULES}`;
}

export function buildSummaryMarkdown(report: StructuredSessionReport): string {
  return [
    `## ${SECTION_TITLES.synthesis}`,
    report.clinical_synthesis || 'Não relatado nesta sessão.',
    '',
    `## ${SECTION_TITLES.reports}`,
    report.patient_reports ||
      'Durante a sessão, não foram trazidos relatos ou conteúdos verbais suficientes para este bloco.',
    '',
    `## ${SECTION_TITLES.observations}`,
    report.clinical_observations ||
      'Durante a sessão, o terapeuta não trouxe observações ou hipóteses clínicas explícitas.',
    '',
    `## ${SECTION_TITLES.management}`,
    report.management_next_steps ||
      'Durante a sessão, não foram registrados manejo ou próximos passos explícitos.',
  ].join('\n');
}

/** Mapeia campos novos → chaves SOAP legado (RAG / consumidores antigos). */
export function mapPsychReportToLegacySoap(report: StructuredSessionReport): {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
} {
  return {
    subjective: report.patient_reports,
    objective: report.clinical_synthesis,
    assessment: report.clinical_observations,
    plan: report.management_next_steps,
  };
}

/** Normaliza resposta do LLM (campos novos ou legado SOAP). */
export function normalizeStructuredSessionReport(raw: unknown): StructuredSessionReport {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const clinical_synthesis = String(
    obj.clinical_synthesis ?? obj.objective ?? '',
  ).trim();
  const patient_reports = String(
    obj.patient_reports ?? obj.subjective ?? '',
  ).trim();
  const clinical_observations = String(
    obj.clinical_observations ?? obj.assessment ?? '',
  ).trim();
  const management_next_steps = String(
    obj.management_next_steps ?? obj.plan ?? '',
  ).trim();
  const transcription = String(obj.transcription ?? '').trim();

  const base: StructuredSessionReport = {
    transcription,
    clinical_synthesis,
    patient_reports,
    clinical_observations,
    management_next_steps,
    summary_markdown: obj.summary_markdown ? String(obj.summary_markdown) : undefined,
  };

  const legacy = mapPsychReportToLegacySoap(base);
  return {
    ...base,
    ...legacy,
    summary_markdown: base.summary_markdown?.trim() || buildSummaryMarkdown(base),
  };
}
