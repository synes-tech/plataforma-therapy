export interface ProcessSessionTextPayload {
  patient_id: string;
  anotacoes_texto: string;
  schedule_id?: string;
  job_id?: string;
}

export interface ProcessSessionTextResponse {
  session_note_id: string;
  job_id: string;
  embeddings_count: number;
  input_mode: 'text';
}
