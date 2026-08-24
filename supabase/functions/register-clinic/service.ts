import { createServiceClient } from '../_shared/supabase.ts';
import { ensureAuthUser } from '../_shared/ensure-auth-user.ts';
import { verifyFirebaseIdentity } from '../_shared/auth.ts';
import {
  buildSignupConfirmRedirect,
  createIdpUser,
  deleteIdpUser,
  isIdpEmailExistsError,
  sendIdpEmailVerification,
  setIdpClaims,
} from '../_shared/identity-platform-admin.ts';
import { AppError, ConflictError } from '../_shared/errors.ts';
import { applyPlanoToClinicSettings } from '../_shared/plan-quotas.ts';
import { computeTrialEndsAt, defaultTrialPlanId } from '../_shared/trial.ts';
import type { RegisterClinicPayload, RegisterClinicResponse } from './types.ts';

export async function registerClinic(payload: RegisterClinicPayload): Promise<RegisterClinicResponse> {
  const supabase = createServiceClient();
  const isGoogleSignup = Boolean(payload.google_id_token);
  const isSoloProfessional = payload.account_type === 'solo';
  const trialEndsAt = computeTrialEndsAt();
  const trialEndsIso = trialEndsAt.toISOString();
  const planId = defaultTrialPlanId(payload.account_type);

  let adminEmail = payload.admin_email.trim().toLowerCase();
  let adminName = payload.admin_name.trim();
  let clinicEmail = payload.clinic_email.trim().toLowerCase();

  const clinicName = isSoloProfessional
    ? `Consultório ${adminName}`.slice(0, 200)
    : (payload.clinic_name ?? '').trim();

  if (!isSoloProfessional && clinicName.length < 2) {
    throw new AppError({
      code: 'VALIDATION_ERROR',
      message: 'Nome da clínica é obrigatório',
      statusCode: 400,
    });
  }

  const userRole = isSoloProfessional ? 'professional' : 'clinic_admin';
  let userId: string;

  if (isGoogleSignup) {
    const identity = await verifyFirebaseIdentity(payload.google_id_token!);
    if (!identity.emailVerified) {
      throw new AppError({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Confirme o e-mail da conta Google para continuar.',
        statusCode: 400,
      });
    }
    userId = identity.id;
    adminEmail = identity.email;
    clinicEmail = identity.email;
    adminName = identity.name ?? adminName;

    const { data: existingProf } = await supabase
      .from('professionals')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    const { data: existingAdmin } = await supabase
      .from('clinic_admins')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    if (existingProf || existingAdmin) {
      throw new ConflictError('Já existe uma conta Unithery com este Google. Faça login.');
    }
    await ensureAuthUser(userId, adminEmail);
  }

  const { data: existingClinic } = await supabase
    .from('clinics')
    .select('id')
    .eq('email', clinicEmail)
    .is('deleted_at', null)
    .single();

  if (existingClinic) {
    throw new ConflictError('Já existe um espaço cadastrado com este email.');
  }

  if (!isGoogleSignup) {
    if (!payload.admin_password) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'Informe senha ou cadastro com Google.',
        statusCode: 400,
      });
    }
    try {
      const user = await createIdpUser({
        email: adminEmail,
        password: payload.admin_password,
        displayName: adminName,
        emailVerified: false,
        claims: { role: userRole },
      });
      userId = user.id;
      await ensureAuthUser(userId, adminEmail);
    } catch (err) {
      if (isIdpEmailExistsError(err)) {
        throw new ConflictError('Já existe uma conta com este email.');
      }
      throw new AppError({
        code: 'AUTH_CREATE_FAILED',
        message: err instanceof Error ? err.message : 'Falha ao criar conta',
        statusCode: 500,
      });
    }
  }

  const { data: clinic, error: clinicError } = await supabase
    .from('clinics')
    .insert({
      name: isSoloProfessional ? `Consultório ${adminName}`.slice(0, 200) : clinicName,
      document: isSoloProfessional ? null : (payload.clinic_document ?? null),
      email: clinicEmail,
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
    if (!isGoogleSignup) await deleteIdpUser(userId);
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
    metadata: { onboarding: 'free_plan_entry', stripe_trial_on_first_checkout: 14 },
  });

  if (isSoloProfessional) {
    const { error: profError } = await supabase
      .from('professionals')
      .insert({
        user_id: userId,
        clinic_id: clinic.id,
        name: adminName,
        email: adminEmail,
        specialty: payload.specialty ?? null,
        status: 'active',
        created_by: userId,
      });

    if (profError) {
      await supabase.from('clinics').delete().eq('id', clinic.id);
      if (!isGoogleSignup) await deleteIdpUser(userId);
      throw new AppError({ code: 'PROFESSIONAL_CREATE_FAILED', message: profError.message, statusCode: 500 });
    }

    await setIdpClaims(userId, { role: 'professional', clinic_id: clinic.id, is_solo: true });
  } else {
    const { error: adminError } = await supabase
      .from('clinic_admins')
      .insert({
        user_id: userId,
        clinic_id: clinic.id,
        name: adminName,
        email: adminEmail,
        created_by: userId,
      });

    if (adminError) {
      await supabase.from('clinics').delete().eq('id', clinic.id);
      if (!isGoogleSignup) await deleteIdpUser(userId);
      throw new AppError({ code: 'ADMIN_LINK_FAILED', message: adminError.message, statusCode: 500 });
    }

    await setIdpClaims(userId, { role: 'clinic_admin', clinic_id: clinic.id });
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

  if (!isGoogleSignup) {
    const confirmRedirect = payload.email_redirect_to
      ?? buildSignupConfirmRedirect(Deno.env.get('PUBLIC_APP_URL') ?? 'https://www.unithery.com');

    try {
      await sendIdpEmailVerification(adminEmail, confirmRedirect);
    } catch (emailErr) {
      await supabase.from('clinics').delete().eq('id', clinic.id);
      if (isSoloProfessional) {
        await supabase.from('professionals').delete().eq('user_id', userId);
      } else {
        await supabase.from('clinic_admins').delete().eq('user_id', userId);
      }
      await deleteIdpUser(userId);
      throw new AppError({
        code: 'CONFIRMATION_EMAIL_FAILED',
        message: emailErr instanceof Error
          ? emailErr.message
          : 'Não foi possível enviar o e-mail de confirmação.',
        statusCode: 500,
      });
    }
  }

  return {
    clinic_id: clinic.id,
    admin_user_id: userId,
    message: isGoogleSignup
      ? 'Conta criada. Você já pode usar a plataforma.'
      : 'Conta criada. Confirme seu e-mail para acessar a plataforma.',
    trial_ends_at: trialEndsIso,
    subscription_status: 'trialing',
    requires_email_confirmation: !isGoogleSignup,
  };
}
