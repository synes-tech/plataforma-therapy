import type { AiArtifactType } from '../copilot/patient-copilot.types';
import type { ArtifactFilterValue } from './patient-artifacts.types';

export const ARTIFACT_FILTER_OPTIONS: Array<{ value: ArtifactFilterValue; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'acao_recomendada', label: 'Ações Recomendadas' },
  { value: 'resumo_proativo', label: 'Resumos' },
  { value: 'relatorio_sessao', label: 'Relatórios' },
];

export const ARTIFACT_BADGE_CONFIG: Record<
  AiArtifactType,
  { label: string; className: string }
> = {
  acao_recomendada: {
    label: 'Ação',
    className: 'bg-amber-50 text-amber-700 ring-amber-100',
  },
  resumo_proativo: {
    label: 'Resumo',
    className: 'bg-primary-50 text-primary-700 ring-primary-100',
  },
  relatorio_sessao: {
    label: 'Relatório',
    className: 'bg-ai-50 text-ai ring-violet-100',
  },
};

export function getArtifactVisibilityBadge(shared: boolean): { label: string; className: string } {
  return shared
    ? { label: '📱 Visível para a família', className: 'bg-mint-50 text-mint-dark ring-mint/20' }
    : { label: '🔒 Apenas visualização interna', className: 'bg-slate-100 text-charcoal-muted ring-slate-200' };
}
