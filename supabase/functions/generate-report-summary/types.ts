export interface ReportSummaryInput {
  session_note_id: string;
}

export interface SoapContent {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface ReportSummaryOutput {
  session_note_id: string;
  summary_bullets: string[];
  generated_at: string;
}
