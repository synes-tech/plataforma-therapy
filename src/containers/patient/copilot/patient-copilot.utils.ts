import type { ConversationTurn, CopilotMessage } from './patient-copilot.types';

const HISTORY_LIMIT = 6;

/** Monta histórico para a API a partir das mensagens já exibidas (exclui a resposta em streaming). */
export function buildConversationHistory(messages: CopilotMessage[]): ConversationTurn[] {
  return messages
    .filter((m) => m.content.trim().length > 0 && !m.streaming)
    .slice(-HISTORY_LIMIT)
    .map((m) => ({ role: m.role, content: m.content }));
}

export function patientFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}
