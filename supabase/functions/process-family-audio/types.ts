export interface InitiateFamilyAudioResponse {
  step: 'initiate';
  upload_url: string;
  storage_path: string;
  mime_type: string;
}

export interface CompleteFamilyAudioResponse {
  step: 'complete';
  transcricao: string;
  audio_url: string;
  duration_seconds?: number;
}

export type ProcessFamilyAudioResponse = InitiateFamilyAudioResponse | CompleteFamilyAudioResponse;
