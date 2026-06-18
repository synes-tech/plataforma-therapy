export interface QueryCopilotPayload {
  patient_id: string;
  message: string;
  stream?: boolean;
  conversation_history?: ConversationMessage[];
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface QueryCopilotResponse {
  answer: string;
  sources: SourceReference[];
  guardrail_triggered: boolean;
  /** true quando o modelo atingiu o limite de tokens (resposta pode estar cortada) */
  answer_incomplete?: boolean;
  tokens_used: number;
  latency_ms: number;
}

export interface SourceReference {
  content_preview: string;
  document_type: string;
  created_at: string;
  similarity: number;
}

export interface RetrievedChunk {
  id: string;
  content: string;
  document_type: string;
  metadata: Record<string, unknown>;
  similarity: number;
  created_at: string;
}
