import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ConflictError } from '../_shared/errors.ts';
import type { RegisterClinicPayload, RegisterClinicResponse } from './types.ts';

export async function registerClinic(payload: RegisterClinicPayload): Promise<RegisterClinicResponse> {
  const supabase = createServiceClient();
  const isSoloProfessional = payload.plan === 'consultorio';

  // 1. Check if clinic email already exists
  const { data: existingClinic } = await supabase
    .from('clinics')
    .select('id')
    .eq('email', payload.clinic_email)
    .is('deleted_at', null)
    .single();

  if (existingClinic) {
    throw new ConflictError('Já existe um espaço cadastrado com este email.');
  }

  // 2. Create the auth user
  const userRole = isSoloProfessional ? 'professional' : 'clinic_admin';
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: payload.admin_email,
    password: payload.admin_password,
    email_confirm: true,
    app_metadata: { role: userRole },
  });

  if (authError || !authData.user) {
    if (authError?.message?.includes('already been registered')) {
      throw new ConflictError('Já existe uma conta com este email.');
    }
    throw new AppError({
      code: 'AUTH_CREATE_FAILED',
      message: authError?.message ?? 'Falha ao criar conta',
      statusCode: 500,
    });
  }

  const userId = authData.user.id;

  // 3. Create the clinic/consultório
  const { data: clinic, error: clinicError } = await supabase
    .from('clinics')
    .insert({
      name: payload.clinic_name,
      document: payload.clinic_document ?? null,
      email: payload.clinic_email,
      phone: payload.clinic_phone ?? null,
      status: 'active',
      subscription_plan: payload.plan ?? 'starter',
      is_solo_professional: isSoloProfessional,
      created_by: userId,
    })
    .select('id')
    .single();

  if (clinicError || !clinic) {
    await supabase.auth.admin.deleteUser(userId);
    throw new AppError({
      code: 'CLINIC_CREATE_FAILED',
      message: clinicError?.message ?? 'Falha ao criar espaço',
      statusCode: 500,
    });
  }

  // 4. Create clinic_settings with plan-appropriate defaults
  const settingsDefaults = isSoloProfessional
    ? { clinic_id: clinic.id, max_professionals: 1, max_patients_per_professional: 50, max_ai_queries_per_month: 300, max_audio_minutes_per_month: 200 }
    : { clinic_id: clinic.id };

  await supabase.from('clinic_settings').insert(settingsDefaults);

  // 5. For CONSULTÓRIO plan: create both clinic_admin AND professional records (same user)
  if (isSoloProfessional) {
    // Create professional record (the solo practitioner)
    const { error: profError } = await supabase
      .from('professionals')
      .insert({
        user_id: userId,
        clinic_id: clinic.id,
        name: payload.admin_name,
        email: payload.admin_email,
        specialty: payload.specialty ?? null,
        status: 'active',
        created_by: userId,
      });

    if (profError) {
      await supabase.from('clinics').delete().eq('id', clinic.id);
      await supabase.auth.admin.deleteUser(userId);
      throw new AppError({ code: 'PROFESSIONAL_CREATE_FAILED', message: profError.message, statusCode: 500 });
    }

    // Update auth metadata with clinic_id (role stays 'professional')
    await supabase.auth.admin.updateUserById(userId, {
      app_metadata: { role: 'professional', clinic_id: clinic.id, is_solo: true },
    });

  } else {
    // Standard clinic flow: create clinic_admin record
    const { error: adminError } = await supabase
      .from('clinic_admins')
      .insert({
        user_id: userId,
        clinic_id: clinic.id,
        name: payload.admin_name,
        email: payload.admin_email,
        created_by: userId,
      });

    if (adminError) {
      await supabase.from('clinics').delete().eq('id', clinic.id);
      await supabase.auth.admin.deleteUser(userId);
      throw new AppError({ code: 'ADMIN_LINK_FAILED', message: adminError.message, statusCode: 500 });
    }

    // Update auth metadata
    await supabase.auth.admin.updateUserById(userId, {
      app_metadata: { role: 'clinic_admin', clinic_id: clinic.id },
    });
  }

  // 6. Audit log
  await supabase.from('audit_logs').insert({
    user_id: userId,
    clinic_id: clinic.id,
    action: 'clinic.register',
    resource_type: 'clinic',
    resource_id: clinic.id,
    metadata: { plan: payload.plan ?? 'starter', is_solo_professional: isSoloProfessional },
  });

  return {
    clinic_id: clinic.id,
    admin_user_id: userId,
    message: isSoloProfessional
      ? 'Consultório criado com sucesso! Faça login para começar.'
      : 'Clínica registrada com sucesso! Faça login para começar.',
  };
}
