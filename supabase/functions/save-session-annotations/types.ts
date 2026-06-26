export interface SaveSessionAnnotationsPayload {
  patient_id: string;
  anotacoes_texto: string | null;
  audio_recording_id?: string;
  schedule_id?: string;
}

export interface SaveSessionAnnotationsResponse {
  audio_recording_id: string | null;
  anotacoes_texto: string | null;
  saved_at: string;
}
