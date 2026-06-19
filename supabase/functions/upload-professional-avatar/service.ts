import { createServiceClient } from '../_shared/supabase.ts';
import { resolveClinicId } from '../_shared/clinic.ts';
import { AppError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type { UploadProfessionalAvatarPayload, UploadProfessionalAvatarResponse } from './types.ts';
import { ALLOWED_MIME, MAX_BYTES } from './schema.ts';

const BUCKET = 'profissionais-avatars';

function mimeToExt(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

async function resolveOwnerTable(
  supabase: ReturnType<typeof createServiceClient>,
  user: AuthenticatedUser,
): Promise<'professionals' | 'clinic_admins'> {
  const { data: admin } = await supabase
    .from('clinic_admins')
    .select('id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (admin) return 'clinic_admins';

  const { data: prof } = await supabase
    .from('professionals')
    .select('id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (prof) return 'professionals';

  throw new AppError({
    code: 'NOT_OWNER',
    message: 'Perfil de proprietário não encontrado',
    statusCode: 403,
  });
}

export async function uploadProfessionalAvatar(
  payload: UploadProfessionalAvatarPayload,
  caller: AuthenticatedUser,
): Promise<UploadProfessionalAvatarResponse> {
  const supabase = createServiceClient();
  const clinicId = await resolveClinicId(supabase, caller);
  const table = await resolveOwnerTable(supabase, caller);
  const expectedPrefix = `${clinicId}/${caller.id}/`;

  if (payload.action === 'confirm') {
    if (!payload.storage_path.startsWith(expectedPrefix)) {
      throw new AppError({ code: 'INVALID_PATH', message: 'Caminho de storage inválido', statusCode: 400 });
    }

    const { data: existing } = await supabase
      .from(table)
      .select('foto_url')
      .eq('user_id', caller.id)
      .is('deleted_at', null)
      .single();

    const oldPath = existing?.foto_url as string | null;
    if (oldPath && oldPath !== payload.storage_path) {
      await supabase.storage.from(BUCKET).remove([oldPath]);
    }

    const { error } = await supabase
      .from(table)
      .update({ foto_url: payload.storage_path })
      .eq('user_id', caller.id)
      .is('deleted_at', null);

    if (error) {
      throw new AppError({ code: 'AVATAR_UPDATE_FAILED', message: error.message, statusCode: 500 });
    }

    await supabase.from('audit_logs').insert({
      user_id: caller.id,
      clinic_id: clinicId,
      action: 'owner.avatar_updated',
      resource_type: table,
      resource_id: caller.id,
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
  const storagePath = `${expectedPrefix}avatar.${ext}`;

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
