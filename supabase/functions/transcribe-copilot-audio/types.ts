export interface InitiateCopilotAudioResponse {
  step: 'initiate';
  upload_url: string;
  storage_path: string;
  mime_type: string;
}

export interface CompleteCopilotAudioResponse {
  step: 'complete';
  transcription: string;
  duration_seconds?: number;
}
