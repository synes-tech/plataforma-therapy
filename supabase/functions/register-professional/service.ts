import { createServiceClient } from '../_shared/supabase.ts';
import {
  createIdpUser,
  deleteIdpUser,
  isIdpEmailExistsError,
} from '../_shared/identity-platform-admin.ts';
import { assertCanAddProfessional } from '../_shared/plan-quotas.ts';
import { AppError, ConflictError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type { RegisterProfessionalPayload, RegisterProfessionalResponse } from './types.ts';

export async function registerProfessional(
  payload: RegisterProfessionalPayload,
  caller: AuthenticatedUser,
): Promise<RegisterProfessionalResponse> {
  const supabase = createServiceClient();
  const clinicId = caller.clinic_id;

  if (!clinicId) {
    throw new AppError({
      code: 'NO_CLINIC',
      message: 'User is not associated with a clinic',
      statusCode: 400,
    });
  }

  await assertCanAddProfessional(clinicId);

  const { data: existingProfessional } = await supabase
    .from('professionals')
    .select('id')
    .eq('email', payload.email)
    .is('deleted_at', null)
    .single();

  if (existingProfessional) {
    throw new ConflictError('A professional with this email already exists');
  }

  let userId: string;
  try {
    const user = await createIdpUser({
      email: payload.email,
      password: payload.password,
      displayName: payload.name,
      emailVerified: true,
      claims: { role: 'professional', clinic_id: clinicId },
    });
    userId = user.id;
  } catch (err) {
    if (isIdpEmailExistsError(err)) {
      throw new ConflictError('An account with this email already exists');
    }
    throw new AppError({
      code: 'AUTH_CREATE_FAILED',
      message: err instanceof Error ? err.message : 'Failed to create auth user',
      statusCode: 500,
    });
  }

  const { data: professional, error: profError } = await supabase
    .from('professionals')
    .insert({
      user_id: userId,
      clinic_id: clinicId,
      name: payload.name,
      email: payload.email,
      specialty: payload.specialty ?? null,
      crp: payload.crp ?? null,
      status: 'active',
      created_by: caller.id,
    })
    .select('id')
    .single();

  if (profError || !professional) {
    await deleteIdpUser(userId);
    throw new AppError({
      code: 'PROFESSIONAL_CREATE_FAILED',
      message: profError?.message ?? 'Failed to create professional',
      statusCode: 500,
    });
  }

  await supabase.from('audit_logs').insert({
    user_id: caller.id,
    clinic_id: clinicId,
    action: 'professional.register',
    resource_type: 'professional',
    resource_id: professional.id,
    metadata: { specialty: payload.specialty },
  });

  return {
    professional_id: professional.id,
    user_id: userId,
    message: 'Professional registered successfully',
  };
}
