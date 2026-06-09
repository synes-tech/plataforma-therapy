import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type { ValidateInvitePayload, ValidateInviteResponse } from './types.ts';

export async function validateInvite(
  payload: ValidateInvitePayload,
  caller: AuthenticatedUser,
): Promise<ValidateInviteResponse> {
  const serviceClient = createServiceClient();

  // Call the transactional RPC that handles everything atomically
  const { data, error } = await serviceClient.rpc('consume_invite', {
    p_code: payload.code,
    p_user_id: caller.id,
    p_name: payload.name,
    p_email: payload.email ?? caller.email,
    p_phone: payload.phone ?? null,
  });

  if (error) {
    // Map RPC exceptions to user-friendly errors
    const message = error.message;

    if (message.includes('INVITE_NOT_FOUND')) {
      throw new AppError({ code: 'INVITE_NOT_FOUND', message: 'Código de convite inválido', statusCode: 404 });
    }
    if (message.includes('INVITE_CONSUMED')) {
      throw new AppError({ code: 'INVITE_CONSUMED', message: 'Este convite já foi utilizado', statusCode: 409 });
    }
    if (message.includes('INVITE_EXPIRED')) {
      throw new AppError({ code: 'INVITE_EXPIRED', message: 'Este convite expirou', statusCode: 410 });
    }
    if (message.includes('INVITE_REVOKED')) {
      throw new AppError({ code: 'INVITE_REVOKED', message: 'Este convite foi revogado', statusCode: 410 });
    }
    if (message.includes('FAMILY_QUOTA_EXCEEDED')) {
      throw new AppError({ code: 'FAMILY_QUOTA_EXCEEDED', message: 'Limite de familiares para este paciente atingido', statusCode: 429 });
    }

    throw new AppError({ code: 'INVITE_VALIDATION_FAILED', message: error.message, statusCode: 500 });
  }

  const result = data as { family_member_id: string; patient_id: string; clinic_id: string; relationship: string };

  // Update user's app_metadata with role and clinic
  await serviceClient.auth.admin.updateUserById(caller.id, {
    app_metadata: { role: 'family', clinic_id: result.clinic_id },
  });

  // Audit log
  await serviceClient.from('audit_logs').insert({
    user_id: caller.id,
    clinic_id: result.clinic_id,
    action: 'invite.consumed',
    resource_type: 'invite',
    resource_id: null,
    metadata: { patient_id: result.patient_id, code: payload.code },
  });

  return {
    family_member_id: result.family_member_id,
    patient_id: result.patient_id,
    clinic_id: result.clinic_id,
    relationship: result.relationship,
    message: 'Vinculação realizada com sucesso',
  };
}
