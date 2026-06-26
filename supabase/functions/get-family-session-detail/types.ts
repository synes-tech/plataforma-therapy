export interface GetFamilySessionDetailPayload {
  session_note_id: string;
  patient_id?: string;
}

export interface GetFamilySessionDetailResponse {
  id: string;
  patient_id: string;
  patient_name: string;
  data_sessao: string;
  therapist_name: string;
  status_nota: string;
  session_title: string;
  scheduled_time: string | null;
  duration_minutes: number | null;
  report_shared: boolean;
  family_report: string | null;
}
