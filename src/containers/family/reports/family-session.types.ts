export interface FamilySessionHistoryItem {
  id: string;
  data_sessao: string;
  horario_sessao: string;
  therapist_name: string;
  status_nota: string;
  report_shared: boolean;
  report_preview: string | null;
}

export interface FamilySessionHistoryResponse {
  patient_id: string;
  patient_name: string;
  items: FamilySessionHistoryItem[];
  page: number;
  page_size: number;
  total_count: number;
  has_more: boolean;
}

export interface FamilySessionDetailResponse {
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
