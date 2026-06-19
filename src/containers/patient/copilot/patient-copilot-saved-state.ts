import { artifactFingerprint, artifactSaveKey } from './patient-copilot-fingerprint';
import type { AiArtifactType, CopilotMessage } from './patient-copilot.types';

export const ARTIFACT_TYPES: AiArtifactType[] = [
  'acao_recomendada',
  'resumo_proativo',
  'relatorio_sessao',
];

export const EMPTY_SAVED_TYPES = new Set<AiArtifactType>();

export function buildAssistantSyncKey(messages: CopilotMessage[]): string {
  return messages
    .filter((m) => m.role === 'assistant' && !m.streaming && m.content.trim())
    .map((m) => `${m.id}:${m.content.length}`)
    .join('|');
}

export async function buildSavedTypesByMessage(
  messages: CopilotMessage[],
  savedKeys: Set<string>,
  fingerprintCache: Map<string, string>,
): Promise<Record<string, Set<AiArtifactType>>> {
  const next: Record<string, Set<AiArtifactType>> = {};

  for (const msg of messages) {
    if (msg.role !== 'assistant' || !msg.content.trim() || msg.streaming) continue;

    const contentCacheKey = `${msg.id}:content`;
    let fingerprint = fingerprintCache.get(msg.id);

    if (fingerprintCache.get(contentCacheKey) !== msg.content) {
      fingerprint = await artifactFingerprint(msg.content);
      fingerprintCache.set(msg.id, fingerprint);
      fingerprintCache.set(contentCacheKey, msg.content);
    }

    const types = new Set<AiArtifactType>();
    for (const tipo of ARTIFACT_TYPES) {
      if (savedKeys.has(artifactSaveKey(fingerprint!, tipo))) {
        types.add(tipo);
      }
    }
    next[msg.id] = types;
  }

  return next;
}

export function mergeSavedType(
  prev: Record<string, Set<AiArtifactType>>,
  messageId: string,
  tipo: AiArtifactType,
): Record<string, Set<AiArtifactType>> {
  const existing = new Set(prev[messageId] ?? []);
  existing.add(tipo);
  return { ...prev, [messageId]: existing };
}

export function removeSavedType(
  prev: Record<string, Set<AiArtifactType>>,
  messageId: string,
  tipo: AiArtifactType,
): Record<string, Set<AiArtifactType>> {
  const existing = new Set(prev[messageId] ?? []);
  existing.delete(tipo);
  return { ...prev, [messageId]: existing };
}
