import { createServiceClient } from '../_shared/supabase.ts';
import { verifyProfessionalPatientWrite } from '../_shared/verify-patient-access.ts';
import { AppError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type { UploadPatientAvatarPayload, UploadPatientAvatarResponse } from './types.ts';
import { ALLOWED_MIME, MAX_BYTES } from './schema.ts';

const BUCKET = 'pacientes-avatars';

function mimeToExt(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

export async function uploadPatientAvatar(
  payload: UploadPatientAvatarPayload,
  caller: AuthenticatedUser,
): Promise<UploadPatientAvatarResponse> {
  const supabase = createServiceClient();
  const ctx = await verifyProfessionalPatientWrite(payload.patient_id, caller);

  if (payload.action === 'confirm') {
    if (!payload.storage_path) {
      throw new AppError({ code: 'VALIDATION_ERROR', message: 'storage_path obrigatório', statusCode: 400 });
    }

    const expectedPrefix = `${ctx.clinic_id}/${ctx.patient_id}/`;
    if (!payload.storage_path.startsWith(expectedPrefix)) {
      throw new AppError({ code: 'INVALID_PATH', message: 'Caminho de storage inválido', statusCode: 400 });
    }

    const { data: existing } = await supabase
      .from('patients')
      .select('foto_url')
      .eq('id', payload.patient_id)
      .single();

    const oldPath = existing?.foto_url as string | null;
    if (oldPath && oldPath !== payload.storage_path) {
      await supabase.storage.from(BUCKET).remove([oldPath]);
    }

    const { error } = await supabase
      .from('patients')
      .update({ foto_url: payload.storage_path })
      .eq('id', payload.patient_id)
      .is('deleted_at', null);

    if (error) {
      throw new AppError({ code: 'AVATAR_UPDATE_FAILED', message: error.message, statusCode: 500 });
    }

    await supabase.from('audit_logs').insert({
      user_id: caller.id,
      clinic_id: ctx.clinic_id,
      action: 'patient.avatar_updated',
      resource_type: 'patient',
      resource_id: payload.patient_id,
      metadata: { storage_path: payload.storage_path },
    });

    return {
      storage_path: payload.storage_path,
      foto_url: payload.storage_path,
      message: 'Foto atualizada com sucesso',
    };
  }

  if (!ALLOWED_MIME.includes(payload.mime_type as typeof ALLOWED_MIME[number])) {
    throw new AppError({ code: 'INVALID_MIME', message: 'Formato de imagem não suportado', statusCode: 400 });
  }

  if (payload.file_size_bytes > MAX_BYTES) {
    throw new AppError({ code: 'FILE_TOO_LARGE', message: 'Imagem deve ter no máximo 5 MB', statusCode: 400 });
  }

  const ext = mimeToExt(payload.mime_type);
  const storagePath = `${ctx.clinic_id}/${payload.patient_id}/avatar.${ext}`;

  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath, { upsert: true });

  if (signError || !signed) {
    throw new AppError({
      code: 'UPLOAD_URL_FAILED',
      message: signError?.message ?? 'Falha ao gerar URL de upload',
      statusCode: 500,
    });
  }

  return {
    upload_url: signed.signedUrl,
    storage_path: storagePath,
    foto_url: storagePath,
    message: 'URL de upload gerada. Envie o arquivo e confirme.',
  };
}
