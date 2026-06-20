export interface UploadAudioPayload {
  patient_id: string;
  recording_type: 'onboarding' | 'post_session' | 'note' | 'clinical_return';
  duration_seconds?: number;
  schedule_id?: string;
}

export interface UploadAudioResponse {
  audio_recording_id: string;
  upload_url: string;  // Signed URL for direct upload to Storage
  job_id: string;
  message: string;
}
