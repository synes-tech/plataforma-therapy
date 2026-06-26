import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import type { PreviewInvitePayload, PreviewInviteResponse } from './types.ts';

function mapInviteRpcError(message: string): AppError {
  if (message.includes('INVITE_NOT_FOUND') || message.includes('INVITE_INVALID_FORMAT')) {
    return new AppError({ code: 'INVITE_NOT_FOUND', message: 'Código de convite inválido', statusCode: 404 });
  }
  if (message.includes('INVITE_CONSUMED')) {
    return new AppError({ code: 'INVITE_CONSUMED', message: 'Este convite já foi utilizado', statusCode: 409 });
  }
  if (message.includes('INVITE_EXPIRED')) {
    return new AppError({ code: 'INVITE_EXPIRED', message: 'Este convite expirou', statusCode: 410 });
  }
  if (message.includes('INVITE_REVOKED')) {
    return new AppError({ code: 'INVITE_REVOKED', message: 'Este convite foi revogado', statusCode: 410 });
  }
  if (message.includes('FAMILY_QUOTA_EXCEEDED')) {
    return new AppError({
      code: 'FAMILY_QUOTA_EXCEEDED',
      message: 'Limite de familiares para este paciente atingido',
      statusCode: 429,
    });
  }

  return new AppError({ code: 'INVITE_PREVIEW_FAILED', message: 'Não foi possível validar o convite', statusCode: 500 });
}

export async function previewInvite(payload: PreviewInvitePayload): Promise<PreviewInviteResponse> {
  const serviceClient = createServiceClient();

  const { data, error } = await serviceClient.rpc('preview_invite', {
    p_code: payload.code,
  });

  if (error) {
    throw mapInviteRpcError(error.message);
  }

  const result = data as { patient_name?: string; relationship?: string };

  if (!result?.patient_name?.trim()) {
    throw new AppError({ code: 'INVITE_PREVIEW_FAILED', message: 'Não foi possível validar o convite', statusCode: 500 });
  }

  return {
    patient_name: result.patient_name.trim(),
    relationship: result.relationship?.trim() || 'responsável',
  };
}
