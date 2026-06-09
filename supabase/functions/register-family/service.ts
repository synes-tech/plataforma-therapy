import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ConflictError } from '../_shared/errors.ts';
import type { RegisterFamilyPayload, RegisterFamilyResponse } from './types.ts';

function mapInviteError(message: string): AppError {
  if (message.includes('INVITE_NOT_FOUND')) {
    return new AppError({ code: 'INVITE_NOT_FOUND', message: 'Código de convite inválido', statusCode: 404 });
  }
  if (message.includes('INVITE_CONSUMED')) {
    return new AppError({ code: 'INVITE_CONSUMED', message: 'Este convite já foi utilizado', statusCode: 409 });
  }
  if (message.includes('INVITE_EXPIRED')) {
    return new AppError({ code: 'INVITE_EXPIRED', message: 'Este convite expirou. Solicite um novo ao terapeuta.', statusCode: 410 });
  }
  if (message.includes('INVITE_REVOKED')) {
    return new AppError({ code: 'INVITE_REVOKED', message: 'Este convite foi revogado', statusCode: 410 });
  }
  if (message.includes('ALREADY_LINKED')) {
    return new AppError({ code: 'ALREADY_LINKED', message: 'Este e-mail já está vinculado a este paciente.', statusCode: 409 });
  }
  if (message.includes('FAMILY_QUOTA_EXCEEDED')) {
    return new AppError({ code: 'FAMILY_QUOTA_EXCEEDED', message: 'Limite de familiares para este paciente atingido', statusCode: 429 });
  }
  return new AppError({ code: 'LINK_FAILED', message, statusCode: 500 });
}

export async function registerFamily(payload: RegisterFamilyPayload): Promise<RegisterFamilyResponse> {
  const supabase = createServiceClient();
  const code = payload.invite_code.trim();
  const name = payload.name.trim();
  const email = payload.email.trim().toLowerCase();

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: payload.password,
    email_confirm: true,
    user_metadata: { full_name: name },
    app_metadata: { role: 'family' },
  });

  if (authError || !authData.user) {
    if (authError?.message?.includes('already been registered') || authError?.message?.includes('already exists')) {
      throw new ConflictError('Já existe uma conta com este e-mail. Faça login para vincular o convite.');
    }
    throw new AppError({
      code: 'AUTH_CREATE_FAILED',
      message: authError?.message ?? 'Falha ao criar conta',
      statusCode: 500,
    });
  }

  const userId = authData.user.id;

  try {
    const { data, error } = await supabase.rpc('consume_invite', {
      p_code: code,
      p_user_id: userId,
      p_name: name,
      p_email: email,
      p_phone: null,
    });

    if (error) throw mapInviteError(error.message);

    const result = data as { family_member_id: string; patient_id: string; clinic_id: string; relationship: string };

    await supabase.auth.admin.updateUserById(userId, {
      app_metadata: { role: 'family', clinic_id: result.clinic_id },
    });

    await supabase.from('audit_logs').insert({
      user_id: userId,
      clinic_id: result.clinic_id,
      action: 'family.register',
      resource_type: 'family_member',
      resource_id: result.family_member_id,
      metadata: { patient_id: result.patient_id, invite_code: code },
    });

    return {
      message: 'Conta criada e vinculada com sucesso!',
      patient_id: result.patient_id,
      clinic_id: result.clinic_id,
    };
  } catch (err) {
    await supabase.auth.admin.deleteUser(userId);
    throw err;
  }
}
