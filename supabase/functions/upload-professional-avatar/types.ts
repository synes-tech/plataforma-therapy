export type UploadProfessionalAvatarPayload =
  | { action: 'initiate'; mime_type: string; file_size_bytes: number }
  | { action: 'confirm'; storage_path: string };

export interface UploadProfessionalAvatarResponse {
  upload_url?: string;
  storage_path: string;
  foto_url: string;
  message: string;
}
