import type { ClinicalRiskLevel } from '../patient-profile.ts';
import type { LexiconScan } from './risk-lexicon.ts';
import { classifierSevereNeedsLexicon } from './risk-followup.utils.ts';

export type RiskDetector = 'lexicon' | 'classifier' | 'both' | 'none';

export interface ClassifierResult {
  risk_level: ClinicalRiskLevel;
  rationale: string;
  signals: string[];
  failed?: boolean;
}

export interface MergedRisk {
  risk_level: ClinicalRiskLevel;
  detector: RiskDetector;
  signals: string[];
  rationale: string;
  emergency: boolean;
}

/**
 * Junta as duas camadas. Regras que não podem quebrar:
 * - Léxico SEVERE nunca é rebaixado pelo classificador (nem se ele falhar).
 * - Classificador SEVERE não é rebaixado pelo léxico, EXCETO follow-up de
 *   exercício ("já fiz") ou negação explícita de ideação — nesses casos o
 *   classificador sozinho gerava falso protocolo.
 * - Suspeita + classificador falho vira MODERATE: o paciente recebe coping, não silêncio.
 * - Suspeita + classificador LOW fica LOW: o eufemismo sozinho não pode virar alarme.
 */
export function mergeRiskLayers(
  lexicon: LexiconScan,
  classifier: ClassifierResult | null,
): MergedRisk {
  const classFailed = !classifier || classifier.failed;
  const classLevel = classFailed ? null : classifier.risk_level;
  const signals = [
    ...lexicon.signals.map((s) => `lexicon:${s.id}`),
    ...(classifier?.signals ?? []).map((s) => `classifier:${s}`),
  ];

  if (lexicon.level === 'SEVERE' && classLevel === 'SEVERE') {
    return done('SEVERE', 'both', signals, classifier?.rationale || 'As duas camadas concordam em risco de vida.');
  }

  if (lexicon.level === 'SEVERE') {
    return done(
      'SEVERE',
      'lexicon',
      signals,
      'Léxico explícito de ideação, plano ou violência. O classificador não rebaixa.',
    );
  }

  if (classLevel === 'SEVERE') {
    if (classifierSevereNeedsLexicon(lexicon.normalized)) {
      return done(
        'LOW',
        'lexicon',
        signals,
        'Classificador SEVERE ignorado: follow-up de exercício ou negação explícita de ideação.',
      );
    }
    return done('SEVERE', 'classifier', signals, classifier!.rationale);
  }

  if (classFailed && lexicon.level === 'SUSPECT') {
    return done(
      'MODERATE',
      'lexicon',
      signals,
      'Eufemismo de sofrimento e classificador indisponível — conduzir coping.',
    );
  }

  if (classLevel === 'MODERATE') {
    return done(
      'MODERATE',
      lexicon.level === 'SUSPECT' ? 'both' : 'classifier',
      signals,
      classifier!.rationale,
    );
  }

  return done(
    'LOW',
    classFailed ? (lexicon.level === 'LOW' ? 'none' : 'lexicon') : 'classifier',
    signals,
    classifier?.rationale || 'Sem sinal de risco.',
  );
}

function done(
  risk_level: ClinicalRiskLevel,
  detector: RiskDetector,
  signals: string[],
  rationale: string,
): MergedRisk {
  return {
    risk_level,
    detector,
    signals,
    rationale,
    emergency: risk_level === 'SEVERE',
  };
}
