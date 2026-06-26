export type SessionInputMode = 'audio' | 'text' | 'dual';

export interface StructuredSessionReport {
  transcription: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  summary_markdown?: string;
}

export const SOAP_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    transcription: { type: 'STRING' },
    subjective: { type: 'STRING' },
    objective: { type: 'STRING' },
    assessment: { type: 'STRING' },
    plan: { type: 'STRING' },
    summary_markdown: { type: 'STRING' },
  },
  required: ['transcription', 'subjective', 'objective', 'assessment', 'plan', 'summary_markdown'],
  propertyOrdering: ['transcription', 'subjective', 'objective', 'assessment', 'plan', 'summary_markdown'],
};

export function resolveSessionInputMode(hasAudio: boolean, hasText: boolean): SessionInputMode {
  if (hasAudio && hasText) return 'dual';
  if (hasAudio) return 'audio';
  return 'text';
}

export function buildAudioSoapPrompt(annotations?: string | null): string {
  const baseRules = `
REGRAS:
- Extraia apenas informações presentes nas fontes fornecidas. NÃO invente dados.
- Se uma seção SOAP não tiver dados suficientes, escreva "Não relatado nesta sessão.".
- O summary_markdown deve ser conciso (2–4 frases por seção), sem emojis, sem blocos de código.
- Não sugira medicações, dosagens ou diagnósticos novos.
- Tom profissional e objetivo.

FORMATO do summary_markdown (use exatamente estes títulos ##):
## Subjetivo
(parágrafo)
## Objetivo
(parágrafo)
## Avaliação
(parágrafo)
## Plano
(parágrafo)

Responda APENAS no JSON do schema fornecido.`;

  if (annotations?.trim()) {
    return `Você é um assistente clínico especializado em terapia infantil (TEA e TDAH).
Você recebeu o ÁUDIO de uma sessão ditada pelo terapeuta E anotações textuais complementares digitadas ao vivo.

ANOTAÇÕES TEXTUAIS DO TERAPEUTA (complemento — integre com o áudio):
"""
${annotations.trim()}
"""

Tarefas:
1. Transcreva o áudio fielmente em português brasileiro (campo "transcription") — texto integral do áudio.
2. Estruture o conteúdo no formato SOAP, mesclando áudio + anotações textuais quando relevante.
3. Use as anotações para enriquecer contexto clínico que o áudio não deixou explícito.
4. Gere "summary_markdown": resumo clínico unificado em Markdown limpo.
${baseRules}`;
  }

  return `Você é um assistente clínico especializado em terapia infantil (TEA e TDAH).
Você recebeu o ÁUDIO de uma sessão ditada pelo terapeuta.

Tarefas:
1. Transcreva o áudio fielmente em português brasileiro (campo "transcription") — texto integral, sem resumir.
2. Estruture o conteúdo no formato SOAP (Subjective, Objective, Assessment, Plan).
3. Gere "summary_markdown": resumo clínico em Markdown limpo para exibição e exportação PDF.
${baseRules}`;
}

export function buildTextOnlySoapPrompt(annotations: string): string {
  return `Você é um assistente clínico especializado em terapia infantil (TEA e TDAH).
O terapeuta registrou a sessão APENAS por anotações textuais (sem áudio).

ANOTAÇÕES TEXTUAIS DO TERAPEUTA:
"""
${annotations.trim()}
"""

Tarefas:
1. No campo "transcription", reproduza fielmente as anotações textuais (ou uma consolidação literal delas).
2. Estruture o conteúdo no formato SOAP com base exclusivamente nessas anotações.
3. Gere "summary_markdown": resumo clínico em Markdown limpo.

REGRAS:
- Use apenas o que está nas anotações. NÃO invente dados.
- Se uma seção SOAP não tiver dados suficientes, escreva "Não relatado nesta sessão.".
- Tom profissional e objetivo.
- Não sugira medicações, dosagens ou diagnósticos novos.

FORMATO do summary_markdown (use exatamente estes títulos ##):
## Subjetivo
## Objetivo
## Avaliação
## Plano

Responda APENAS no JSON do schema fornecido.`;
}

export function buildSummaryMarkdown(soap: StructuredSessionReport): string {
  return [
    '## Subjetivo',
    soap.subjective || 'Não relatado nesta sessão.',
    '',
    '## Objetivo',
    soap.objective || 'Não relatado nesta sessão.',
    '',
    '## Avaliação',
    soap.assessment || 'Não relatado nesta sessão.',
    '',
    '## Plano',
    soap.plan || 'Não relatado nesta sessão.',
  ].join('\n');
}
