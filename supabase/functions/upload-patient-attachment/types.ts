import type { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import type { UploadPatientAttachmentSchema } from './schema.ts';

export type UploadPatientAttachmentPayload = z.infer<typeof UploadPatientAttachmentSchema>;

export interface PatientAttachmentRow {
  id: string;
  patient_id: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  status: 'uploading' | 'processing' | 'ready' | 'failed';
  processing_error: string | null;
  extracted_char_count: number | null;
  embeddings_count: number;
  ai_summary: string | null;
  description: string | null;
  created_at: string;
}

export interface UploadPatientAttachmentResponse {
  attachment_id?: string;
  upload_url?: string;
  storage_path: string;
  attachment?: PatientAttachmentRow;
  message: string;
}
