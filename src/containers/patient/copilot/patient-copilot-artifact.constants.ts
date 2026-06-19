import type { AiArtifactType } from './patient-copilot.types';

export const AI_ARTIFACT_OPTIONS: Array<{
  type: AiArtifactType;
  label: string;
  icon: string;
  toastLabel: string;
}> = [
  {
    type: 'acao_recomendada',
    label: 'Ação recomendada',
    icon: '💡',
    toastLabel: 'Ação recomendada salva',
  },
  {
    type: 'resumo_proativo',
    label: 'Resumo proativo',
    icon: '📄',
    toastLabel: 'Resumo proativo salvo',
  },
  {
    type: 'relatorio_sessao',
    label: 'Relatório',
    icon: '📋',
    toastLabel: 'Relatório salvo',
  },
];

export const ARTIFACT_TOAST_MESSAGES: Record<AiArtifactType, string> = Object.fromEntries(
  AI_ARTIFACT_OPTIONS.map((o) => [o.type, o.toastLabel]),
) as Record<AiArtifactType, string>;
