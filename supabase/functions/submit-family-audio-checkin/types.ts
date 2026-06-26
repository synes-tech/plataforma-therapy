import type { FamilyDiaryCheckinExtract } from '../_shared/family-diary-checkin-extract.ts';

export interface SubmitFamilyAudioCheckinPayload {
  patient_id: string;
  entry_date?: string;
  transcricao: string;
  audio_note_url: string;
  duration_seconds?: number;
}

export interface SubmitFamilyAudioCheckinResponse {
  diary_entry_id: string;
  message: string;
  extracted: FamilyDiaryCheckinExtract;
}
