import { createServiceClient } from '../_shared/supabase.ts';
import { verifyProfessionalPatientWrite } from '../_shared/verify-patient-access.ts';
import { processPatientAttachment } from '../_shared/patient-attachment-pipeline.ts';
import { AppError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};
import type {
  PatientAttachmentRow,
  UploadPatientAttachmentPayload,
  UploadPatientAttachmentResponse,
} from './types.ts';
import { ALLOWED_ATTACHMENT_MIME, MAX_ATTACHMENT_BYTES } from './schema.ts';
import {
  buildAttachmentStoragePath,
  isValidAttachmentStoragePath,
} from '../_shared/patient-attachment-security.ts';

const BUCKET = 'pacientes-anexos';

function mapAttachmentRow(row: Record<string, unknown>): PatientAttachmentRow {
  return {
    id: row.id as string,
    patient_id: row.patient_id as string,
    file_name: row.file_name as string,
    mime_type: row.mime_type as string,
    file_size_bytes: Number(row.file_size_bytes),
    status: row.status as PatientAttachmentRow['status'],
    processing_error: (row.processing_error as string | null) ?? null,
    extracted_char_count: row.extracted_char_count == null ? null : Number(row.extracted_char_count),
    embeddings_count: Number(row.embeddings_count ?? 0),
    ai_summary: (row.ai_summary as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    created_at: row.created_at as string,
  };
}

export async function uploadPatientAttachment(
  payload: UploadPatientAttachmentPayload,
  caller: AuthenticatedUser,
): Promise<UploadPatientAttachmentResponse> {
  const supabase = createServiceClient();
  const ctx = await verifyProfessionalPatientWrite(payload.patient_id, caller);

  if (!ALLOWED_ATTACHMENT_MIME.includes(payload.mime_type)) {
    throw new AppError({ code: 'INVALID_MIME', message: 'Formato de arquivo não suportado', statusCode: 400 });
  }

  if (payload.file_size_bytes > MAX_ATTACHMENT_BYTES) {
    throw new AppError({ code: 'FILE_TOO_LARGE', message: 'Arquivo deve ter no máximo 15 MB', statusCode: 400 });
  }

  if (payload.action === 'initiate') {
    const attachmentId = crypto.randomUUID();
    const storagePath = buildAttachmentStoragePath(
      ctx.clinic_id,
      ctx.patient_id,
      attachmentId,
      payload.file_name,
    );

    const { data: signed, error: signError } = await supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath, { upsert: false });

    if (signError || !signed) {
      throw new AppError({
        code: 'UPLOAD_URL_FAILED',
        message: signError?.message ?? 'Falha ao gerar URL de upload',
        statusCode: 500,
      });
    }

    return {
      attachment_id: attachmentId,
      upload_url: signed.signedUrl,
      storage_path: storagePath,
      message: 'URL de upload gerada. Envie o arquivo e confirme.',
    };
  }

  if (
    !isValidAttachmentStoragePath(
      payload.storage_path,
      ctx.clinic_id,
      ctx.patient_id,
      payload.attachment_id,
    )
  ) {
    throw new AppError({ code: 'INVALID_PATH', message: 'Caminho de storage inválido', statusCode: 400 });
  }

  const { data: inserted, error: insertError } = await supabase
    .from('patient_attachments')
    .insert({
      id: payload.attachment_id,
      patient_id: ctx.patient_id,
      clinic_id: ctx.clinic_id,
      professional_id: ctx.caller_professional_id,
      storage_path: payload.storage_path,
      file_name: payload.file_name,
      mime_type: payload.mime_type,
      file_size_bytes: payload.file_size_bytes,
      status: 'processing',
      description: payload.description?.trim() || null,
    })
    .select('*')
    .single();

  if (insertError || !inserted) {
    throw new AppError({
      code: 'ATTACHMENT_INSERT_FAILED',
      message: insertError?.message ?? 'Falha ao registrar anexo',
      statusCode: 500,
    });
  }

  const processingParams = {
    attachment_id: payload.attachment_id,
    patient_id: ctx.patient_id,
    clinic_id: ctx.clinic_id,
    storage_path: payload.storage_path,
    file_name: payload.file_name,
    mime_type: payload.mime_type,
  };

  const runProcessing = async () => {
    try {
      const processed = await processPatientAttachment(processingParams);

      await supabase
        .from('patient_attachments')
        .update({
          status: 'ready',
          processing_error: null,
          extracted_char_count: processed.extracted_char_count,
          embeddings_count: processed.embeddings_count,
          ai_summary: processed.ai_summary,
        })
        .eq('id', payload.attachment_id);

      await supabase.from('audit_logs').insert({
        user_id: caller.id,
        clinic_id: ctx.clinic_id,
        action: 'patient.attachment_uploaded',
        resource_type: 'patient_attachment',
        resource_id: payload.attachment_id,
        metadata: {
          patient_id: ctx.patient_id,
          file_name: payload.file_name,
          embeddings_count: processed.embeddings_count,
          async: true,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao processar anexo';
      await supabase
        .from('patient_attachments')
        .update({ status: 'failed', processing_error: message.slice(0, 500) })
        .eq('id', payload.attachment_id);
    }
  };

  const background = runProcessing();
  if (typeof EdgeRuntime !== 'undefined' && 'waitUntil' in EdgeRuntime) {
    EdgeRuntime.waitUntil(background);
  } else {
    void background;
  }

  return {
    storage_path: payload.storage_path,
    attachment: mapAttachmentRow(inserted as Record<string, unknown>),
    message: 'Anexo recebido. A IA continuará processando em segundo plano.',
  };
}
