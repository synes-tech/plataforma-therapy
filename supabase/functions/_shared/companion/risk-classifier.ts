import { COMPANION_CHAT_MODEL, vertexJSON } from '../vertex.ts';
import type { ClinicalRiskLevel } from '../patient-profile.ts';
import type { ClassifierResult } from './risk-merge.ts';
import { CLASSIFIER_SYSTEM } from './risk-classifier.prompt.ts';

export { CLASSIFIER_SYSTEM };

const CLASSIFIER_SCHEMA = {
  type: 'OBJECT',
  properties: {
    risk_level: { type: 'STRING', enum: ['LOW', 'MODERATE', 'SEVERE'] },
    rationale: { type: 'STRING' },
    signals: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['risk_level', 'rationale', 'signals'],
};

export async function classifyCompanionRisk(
  message: string,
  context?: { priorAssistant?: string | null },
): Promise<ClassifierResult> {
  const prior = context?.priorAssistant?.trim()
    ? `\nÚltima fala da Ivy (contexto, não classifique ela):\n"""${context.priorAssistant.slice(0, 500)}"""\n`
    : '';
  try {
    const { data } = await vertexJSON<ClassifierResult>(
      [{ text: `${prior}Mensagem do paciente:\n"""${message.slice(0, 2000)}"""` }],
      {
        model: COMPANION_CHAT_MODEL,
        system: CLASSIFIER_SYSTEM,
        temperature: 0,
        maxOutputTokens: 256,
        thinkingBudget: 0,
        responseSchema: CLASSIFIER_SCHEMA,
      },
    );

    const level = (['LOW', 'MODERATE', 'SEVERE'] as const).includes(data.risk_level as ClinicalRiskLevel)
      ? (data.risk_level as ClinicalRiskLevel)
      : 'MODERATE';

    return {
      risk_level: level,
      rationale: String(data.rationale ?? '').slice(0, 400),
      signals: Array.isArray(data.signals) ? data.signals.map(String).slice(0, 8) : [],
    };
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      action: 'companion_classifier_failed',
      message: error instanceof Error ? error.message : String(error),
    }));
    return {
      risk_level: 'LOW',
      rationale: 'Classificador indisponível.',
      signals: ['classifier_failed'],
      failed: true,
    };
  }
}
