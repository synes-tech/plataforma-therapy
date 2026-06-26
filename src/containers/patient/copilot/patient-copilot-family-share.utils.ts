import type { AiArtifactType } from './patient-copilot.types';
import { ARTIFACT_TOAST_MESSAGES } from './patient-copilot-artifact.constants';

export function getFamilyShareStatusLabel(shared: boolean): string {
  return shared ? '📱 Visível para a família' : '🔒 Apenas visualização interna';
}

export function buildArtifactSaveToast(tipo: AiArtifactType, shared: boolean): string {
  const base = ARTIFACT_TOAST_MESSAGES[tipo] ?? 'Documento salvo';
  return shared ? `${base} — visível para a família` : `${base} — uso interno`;
}

export function buildVisibilityChangeToast(shared: boolean): string {
  return shared
    ? 'Visibilidade atualizada — família pode ver este documento'
    : 'Visibilidade atualizada — apenas uso interno';
}
