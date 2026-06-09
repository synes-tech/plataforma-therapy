import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ConflictError, QuotaExceededError } from '../_shared/errors.ts';
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

  // 1. Check clinic quota
  const { data: settings } = await supabase
    .from('clinic_settings')
    .select('max_professionals')
    .eq('clinic_id', clinicId)
    .single();

  const maxProfessionals = settings?.max_professionals ?? 5;

  const { count: currentCount } = await supabase
    .from('professionals')
    .select('id', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .is('deleted_at', null);

  if ((currentCount ?? 0) >= maxProfessionals) {
    throw new QuotaExceededError('professionals');
  }

  // 2. Check if email already in use
  const { data: existingProfessional } = await supabase
    .from('professionals')
    .select('id')
    .eq('email', payload.email)
    .is('deleted_at', null)
    .single();

  if (existingProfessional) {
    throw new ConflictError('A professional with this email already exists');
  }

  // 3. Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: payload.email,
    password: payload.password,
    email_confirm: true,
    app_metadata: { role: 'professional', clinic_id: clinicId },
  });

  if (authError || !authData.user) {
    if (authError?.message?.includes('already been registered')) {
      throw new ConflictError('An account with this email already exists');
    }
    throw new AppError({
      code: 'AUTH_CREATE_FAILED',
      message: authError?.message ?? 'Failed to create auth user',
      statusCode: 500,
    });
  }

  const userId = authData.user.id;

  // 4. Create professional record
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
    // Rollback auth user
    await supabase.auth.admin.deleteUser(userId);
    throw new AppError({
      code: 'PROFESSIONAL_CREATE_FAILED',
      message: profError?.message ?? 'Failed to create professional',
      statusCode: 500,
    });
  }

  // 5. Audit log
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
