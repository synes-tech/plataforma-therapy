export interface ProcessClinicalReturnInput {
  audio_recording_id: string;
  patient_id: string;
  job_id: string;
}

export interface CleanTranscription {
  transcription: string;
  cleaned_text: string;
}

export interface ProcessClinicalReturnResult {
  transcription_id: string;
  cleaned_text: string;
}
