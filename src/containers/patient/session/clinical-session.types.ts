export type ClinicalSessionInputMode = 'audio' | 'text' | 'dual';

/** Payload agrupado pelo workspace — enviado à API na Fase 3. */
export interface ClinicalSessionPayload {
  patient_id: string;
  schedule_id?: string;
  input_mode: ClinicalSessionInputMode;
  anotacoes_texto?: string;
  audio_blob?: Blob;
  audio_duration_seconds?: number;
  audio_mime_type?: string;
}

export interface ClinicalSessionFinalizeResult {
  payload: ClinicalSessionPayload;
  summary: string;
}
