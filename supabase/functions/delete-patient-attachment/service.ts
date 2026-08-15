import { createServiceClient } from '../_shared/supabase.ts';
import { verifyProfessionalPatientWrite } from '../_shared/verify-patient-access.ts';
import { AppError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import type { DeletePatientAttachmentSchema } from './schema.ts';

const BUCKET = 'pacientes-anexos';

export type DeletePatientAttachmentPayload = z.infer<typeof DeletePatientAttachmentSchema>;

export async function deletePatientAttachment(
  payload: DeletePatientAttachmentPayload,
  caller: AuthenticatedUser,
) {
  const ctx = await verifyProfessionalPatientWrite(payload.patient_id, caller);
  const supabase = createServiceClient();

  const { data: attachment, error } = await supabase
    .from('patient_attachments')
    .select('id, storage_path')
    .eq('id', payload.attachment_id)
    .eq('patient_id', ctx.patient_id)
    .is('deleted_at', null)
    .single();

  if (error || !attachment) {
    throw new AppError({ code: 'ATTACHMENT_NOT_FOUND', message: 'Anexo não encontrado', statusCode: 404 });
  }

  await supabase
    .from('patient_embeddings')
    .delete()
    .eq('patient_id', ctx.patient_id)
    .eq('document_type', 'patient_attachment')
    .eq('source_id', payload.attachment_id);

  const { error: softDeleteError } = await supabase
    .from('patient_attachments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', payload.attachment_id);

  if (softDeleteError) {
    throw new AppError({
      code: 'ATTACHMENT_DELETE_FAILED',
      message: softDeleteError.message,
      statusCode: 500,
    });
  }

  const { removePaths } = await import('../_shared/object-storage.ts');
  await removePaths(BUCKET, [attachment.storage_path as string]);

  await supabase.from('audit_logs').insert({
    user_id: caller.id,
    clinic_id: ctx.clinic_id,
    action: 'patient.attachment_deleted',
    resource_type: 'patient_attachment',
    resource_id: payload.attachment_id,
    metadata: { patient_id: ctx.patient_id },
  });

  return { deleted: true };
}
