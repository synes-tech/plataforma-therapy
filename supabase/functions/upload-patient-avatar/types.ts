export interface UploadPatientAvatarPayload {
  patient_id: string;
  mime_type: string;
  file_size_bytes: number;
  action?: 'initiate' | 'confirm';
  storage_path?: string;
}

export interface UploadPatientAvatarResponse {
  upload_url?: string;
  storage_path: string;
  foto_url: string;
  message: string;
}
