export interface SubmitDiaryPayload {
  patient_id: string;
  entry_date?: string;
  mood_score: number;
  sleep_quality: number;
  crisis_occurred: boolean;
  crisis_level?: number;
  categories: string[];
  notes?: string;
  audio_note_url?: string;
  transcricao?: string;
}

export interface SubmitDiaryResponse {
  diary_entry_id: string;
  message: string;
}
