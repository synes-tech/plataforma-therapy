export interface FamilySessionHistoryItem {
  id: string;
  data_sessao: string;
  horario_sessao: string;
  therapist_name: string;
  status_nota: string;
  report_shared: boolean;
  /** Preenchido apenas quando o terapeuta compartilhou o relatório. */
  report_preview: string | null;
}

export interface GetFamilySessionHistoryPayload {
  patient_id?: string;
  page?: number;
  page_size?: number;
}

export interface GetFamilySessionHistoryResponse {
  patient_id: string;
  patient_name: string;
  items: FamilySessionHistoryItem[];
  page: number;
  page_size: number;
  total_count: number;
  has_more: boolean;
}
