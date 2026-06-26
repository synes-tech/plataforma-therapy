export interface ProcessAudioInput {
  audio_recording_id: string;
  patient_id: string;
  job_id: string;
  anotacoes_texto?: string | null;
}

export interface SOAPNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  summary_markdown?: string;
}

export interface TranscriptionResult {
  text: string;
  language: string;
  duration_ms: number;
}

export interface ProcessAudioResult {
  transcription_id: string;
  session_note_id: string;
  embeddings_count: number;
  input_mode?: 'audio' | 'text' | 'dual';
}
