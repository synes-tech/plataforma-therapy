export interface SessionSoapContent {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  summary_markdown?: string;
  transcription?: string;
}

export interface PatientSessionRecord {
  id: string;
  paciente_id: string;
  data_sessao: string;
  status_nota: string;
  audio_url: string | null;
  audio_mime_type: string | null;
  audio_duracao_segundos: number | null;
  transcricao_completa: string | null;
  resumo_ia: SessionSoapContent;
}

export interface PatientSessionsResponse {
  items: PatientSessionRecord[];
  page: number;
  page_size: number;
  total_count: number;
  has_more: boolean;
}

export const SESSION_STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho',
  approved: 'Aprovada',
  archived: 'Arquivada',
};
