export interface GeneratePatientSummaryPayload {
  patient_id: string;
}

export interface GeneratePatientSummaryResponse {
  summary_markdown: string;
  generated_at: string;
  tokens_used: number;
  latency_ms: number;
  answer_incomplete?: boolean;
  scope: {
    sessions_included: number;
    total_sessions: number;
  };
}

export interface SummaryContextRow {
  found: boolean;
  session_count?: number;
  has_clinical_data?: boolean;
  patient_profile?: string;
  initial_session?: string;
  recent_sessions?: string;
  diary_summary?: string;
  evolution_summary?: string;
}
