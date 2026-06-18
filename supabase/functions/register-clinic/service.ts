import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ConflictError } from '../_shared/errors.ts';
import { applyPlanoToClinicSettings } from '../_shared/plan-quotas.ts';
import { computeTrialEndsAt, defaultTrialPlanId } from '../_shared/trial.ts';
import type { RegisterClinicPayload, RegisterClinicResponse } from './types.ts';

export async function registerClinic(payload: RegisterClinicPayload): Promise<RegisterClinicResponse> {
  const supabase = createServiceClient();
  const isSoloProfessional = payload.account_type === 'solo';
  const trialEndsAt = computeTrialEndsAt();
  const trialEndsIso = trialEndsAt.toISOString();
  const planId = defaultTrialPlanId(payload.account_type);

  const clinicName = isSoloProfessional
    ? `Consultório ${payload.admin_name}`.slice(0, 200)
    : (payload.clinic_name ?? '').trim();

  if (!isSoloProfessional && clinicName.length < 2) {
    throw new AppError({
      code: 'VALIDATION_ERROR',
      message: 'Nome da clínica é obrigatório',
      statusCode: 400,
    });
  }

  const { data: existingClinic } = await supabase
    .from('clinics')
    .select('id')
    .eq('email', payload.clinic_email)
    .is('deleted_at', null)
    .single();

  if (existingClinic) {
    throw new ConflictError('Já existe um espaço cadastrado com este email.');
  }

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

  const { data: clinic, error: clinicError } = await supabase
    .from('clinics')
    .insert({
      name: clinicName,
      document: isSoloProfessional ? null : (payload.clinic_document ?? null),
      email: payload.clinic_email,
      phone: payload.clinic_phone ?? null,
      status: 'active',
      subscription_plan: planId,
      subscription_status: 'trialing',
      trial_ends_at: trialEndsIso,
      is_solo_professional: isSoloProfessional,
      account_type: isSoloProfessional ? 'solo' : 'corporate',
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

  await applyPlanoToClinicSettings(clinic.id, planId);

  await supabase.from('clinic_subscriptions').insert({
    clinic_id: clinic.id,
    plan: planId,
    status: 'trialing',
    started_at: new Date().toISOString(),
    ends_at: trialEndsIso,
    metadata: { trial_days: 14, onboarding: 'phase1_plg' },
  });

  if (isSoloProfessional) {
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

    await supabase.auth.admin.updateUserById(userId, {
      app_metadata: { role: 'professional', clinic_id: clinic.id, is_solo: true },
    });
  } else {
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

    await supabase.auth.admin.updateUserById(userId, {
      app_metadata: { role: 'clinic_admin', clinic_id: clinic.id },
    });
  }

  await supabase.from('audit_logs').insert({
    user_id: userId,
    clinic_id: clinic.id,
    action: 'clinic.register',
    resource_type: 'clinic',
    resource_id: clinic.id,
    metadata: {
      plan: planId,
      is_solo_professional: isSoloProfessional,
      subscription_status: 'trialing',
      trial_ends_at: trialEndsIso,
    },
  });

  return {
    clinic_id: clinic.id,
    admin_user_id: userId,
    message: 'Conta criada com sucesso! Bem-vindo ao Unithery.',
    trial_ends_at: trialEndsIso,
    subscription_status: 'trialing',
  };
}
