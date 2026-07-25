export type PatientAttachmentStatus = 'uploading' | 'processing' | 'ready' | 'failed';

export interface PatientAttachment {
  id: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  status: PatientAttachmentStatus;
  processing_error: string | null;
  extracted_char_count: number | null;
  embeddings_count: number;
  description: string | null;
  ai_summary: string | null;
  created_at: string;
  download_url: string | null;
}

export interface PatientAttachmentsResponse {
  items: PatientAttachment[];
}

export const ALLOWED_ATTACHMENT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt'] as const;

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
] as const;

export const MAX_ATTACHMENT_SIZE_BYTES = 15 * 1024 * 1024;
