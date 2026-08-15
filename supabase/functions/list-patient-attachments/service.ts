import { createServiceClient } from '../_shared/supabase.ts';
import { verifyPatientAccess } from '../_shared/verify-patient-access.ts';
import { createReadUrl } from '../_shared/object-storage.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import type { ListPatientAttachmentsSchema } from './schema.ts';

export type ListPatientAttachmentsPayload = z.infer<typeof ListPatientAttachmentsSchema>;

export interface PatientAttachmentListItem {
  id: string;
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
  download_url: string | null;
}

const BUCKET = 'pacientes-anexos';

export async function listPatientAttachments(
  payload: ListPatientAttachmentsPayload,
  caller: AuthenticatedUser,
) {
  await verifyPatientAccess(payload.patient_id, caller);
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('patient_attachments')
    .select(
      'id, file_name, mime_type, file_size_bytes, status, processing_error, extracted_char_count, embeddings_count, ai_summary, description, created_at, storage_path',
    )
    .eq('patient_id', payload.patient_id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const items: PatientAttachmentListItem[] = [];

  for (const row of data ?? []) {
    let downloadUrl: string | null = null;
    if (row.status === 'ready') {
      try {
        const signed = await createReadUrl(BUCKET, row.storage_path as string, 3600);
        downloadUrl = signed.signedUrl;
      } catch {
        downloadUrl = null;
      }
    }

    items.push({
      id: row.id as string,
      file_name: row.file_name as string,
      mime_type: row.mime_type as string,
      file_size_bytes: Number(row.file_size_bytes),
      status: row.status as PatientAttachmentListItem['status'],
      processing_error: (row.processing_error as string | null) ?? null,
      extracted_char_count: row.extracted_char_count == null ? null : Number(row.extracted_char_count),
      embeddings_count: Number(row.embeddings_count ?? 0),
      ai_summary: (row.ai_summary as string | null) ?? null,
      description: (row.description as string | null) ?? null,
      created_at: row.created_at as string,
      download_url: downloadUrl,
    });
  }

  return { items };
}
