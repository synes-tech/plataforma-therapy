export interface GenerateCompanionSummariesResponse {
  period_start: string;
  period_end: string;
  scanned: number;
  generated: number;
  skipped_no_consent: number;
  skipped_existing: number;
  skipped_empty: number;
  failed: number;
}
