export type AiArtifactType = 'acao_recomendada' | 'resumo_proativo' | 'relatorio_sessao';

export interface PlanItemInput {
  title: string;
  content: string;
}

export interface CopilotSourceRef {
  content_preview: string;
  document_type: string;
  created_at: string;
  similarity: number;
}

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  inputSource?: 'text' | 'audio';
  sources?: CopilotSourceRef[];
  guardrail_triggered?: boolean;
  answer_incomplete?: boolean;
  streaming?: boolean;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}
