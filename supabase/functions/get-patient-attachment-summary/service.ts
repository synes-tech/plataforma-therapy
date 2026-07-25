import { createServiceClient } from '../_shared/supabase.ts';
import { verifyPatientAccess } from '../_shared/verify-patient-access.ts';
import { processPatientAttachment } from '../_shared/patient-attachment-pipeline.ts';
import { AppError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type { GetPatientAttachmentSummaryPayload } from './schema.ts';

export interface GetPatientAttachmentSummaryResponse {
  attachment_id: string;
  file_name: string;
  ai_summary: string;
  generated_now: boolean;
}

export async function getPatientAttachmentSummary(
  payload: GetPatientAttachmentSummaryPayload,
  caller: AuthenticatedUser,
): Promise<GetPatientAttachmentSummaryResponse> {
  await verifyPatientAccess(payload.patient_id, caller);
  const supabase = createServiceClient();

  const { data: row, error } = await supabase
    .from('patient_attachments')
    .select('id, patient_id, clinic_id, file_name, status, ai_summary, storage_path, mime_type')
    .eq('id', payload.attachment_id)
    .eq('patient_id', payload.patient_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !row) {
    throw new AppError({
      code: 'ATTACHMENT_NOT_FOUND',
      message: 'Anexo não encontrado',
      statusCode: 404,
    });
  }

  if (row.status === 'processing' || row.status === 'uploading') {
    throw new AppError({
      code: 'ATTACHMENT_PROCESSING',
      message: 'O documento ainda está sendo processado. Tente novamente em instantes.',
      statusCode: 409,
    });
  }

  if (row.status === 'failed') {
    throw new AppError({
      code: 'ATTACHMENT_FAILED',
      message: 'Não foi possível processar este anexo.',
      statusCode: 422,
    });
  }

  const existing = (row.ai_summary as string | null)?.trim();
  if (existing) {
    return {
      attachment_id: row.id as string,
      file_name: row.file_name as string,
      ai_summary: existing,
      generated_now: false,
    };
  }

  const processed = await processPatientAttachment({
    attachment_id: row.id as string,
    patient_id: row.patient_id as string,
    clinic_id: row.clinic_id as string,
    storage_path: row.storage_path as string,
    file_name: row.file_name as string,
    mime_type: row.mime_type as string,
  });

  await supabase
    .from('patient_attachments')
    .update({
      ai_summary: processed.ai_summary,
      extracted_char_count: processed.extracted_char_count,
      embeddings_count: processed.embeddings_count,
      status: 'ready',
      processing_error: null,
    })
    .eq('id', row.id);

  return {
    attachment_id: row.id as string,
    file_name: row.file_name as string,
    ai_summary: processed.ai_summary,
    generated_now: true,
  };
}
