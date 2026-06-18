export interface GenerateProactiveSummaryPayload {
  patient_id: string;
  force?: boolean;
}

export interface GenerateProactiveSummaryResponse {
  summary_markdown: string;
  generated_at: string;
  updated_at: string;
  from_cache: boolean;
  tokens_used: number;
  latency_ms: number;
  answer_incomplete?: boolean;
  diary_entries_count: number;
}

export interface ProactiveContextRow {
  found: boolean;
  has_diary_data?: boolean;
  diary_entries_count?: number;
  patient_profile?: string;
  weekly_diary?: string;
  recent_sessions?: string;
  evolution_summary?: string;
}

export const PROACTIVE_SUMMARY_TTL_HOURS = 24;
