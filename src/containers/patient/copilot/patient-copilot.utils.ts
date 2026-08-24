import type {
  ConversationTurn,
  CopilotMessage,
  PersistedCopilotMessage,
} from './patient-copilot.types';

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

export function mapPersistedCopilotMessages(
  rows: PersistedCopilotMessage[] | undefined,
): CopilotMessage[] {
  if (!rows?.length) return [];
  return rows
    .filter((row) => row.content.trim().length > 0 && (row.role === 'user' || row.role === 'assistant'))
    .map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      inputSource: row.input_source,
      sources: row.sources,
      guardrail_triggered: row.guardrail_triggered,
      answer_incomplete: row.answer_incomplete,
    }));
}
