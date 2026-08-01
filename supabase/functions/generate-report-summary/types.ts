export interface ReportSummaryInput {
  session_note_id: string;
}

export interface SoapContent {
  clinical_synthesis?: string;
  patient_reports?: string;
  clinical_observations?: string;
  management_next_steps?: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  summary_markdown?: string;
}

export interface ReportSummaryOutput {
  session_note_id: string;
  summary_bullets: string[];
  generated_at: string;
}
