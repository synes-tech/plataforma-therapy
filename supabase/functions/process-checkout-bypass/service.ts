import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ForbiddenError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import { applyPlanoToClinicSettings } from '../_shared/plan-quotas.ts';
import { computeTrialEndsAt } from '../_shared/trial.ts';
import type { ProcessCheckoutBypassPayload, ProcessCheckoutBypassResponse } from './types.ts';

const BYPASS_DELAY_MS = 1500;

const SOLO_PLANS = new Set(['consultorio']);
const CORPORATE_PLANS = new Set(['starter', 'professional', 'enterprise']);

function assertPlanAllowedForAccount(
  planId: string,
  isSolo: boolean,
): void {
  const allowed = isSolo ? SOLO_PLANS : CORPORATE_PLANS;
  if (!allowed.has(planId)) {
    throw new AppError({
      code: 'PLAN_NOT_ALLOWED',
      message: 'Plano incompatível com o perfil da conta',
      statusCode: 403,
    });
  }
}

export async function processCheckoutBypass(
  payload: ProcessCheckoutBypassPayload,
  caller: AuthenticatedUser,
): Promise<ProcessCheckoutBypassResponse> {
  if (!caller.clinic_id) {
    throw new ForbiddenError('Usuário sem clínica associada');
  }

  const clinicId = caller.clinic_id;
  const supabase = createServiceClient();

  const { data: clinic, error: clinicError } = await supabase
    .from('clinics')
    .select('id, subscription_status, trial_ends_at, is_solo_professional, account_type, payment_method_on_file')
    .eq('id', clinicId)
    .is('deleted_at', null)
    .single();

  if (clinicError || !clinic) {
    throw new AppError({
      code: 'CLINIC_NOT_FOUND',
      message: 'Clínica não encontrada',
      statusCode: 404,
    });
  }

  if (clinic.payment_method_on_file === true || clinic.subscription_status === 'trial_active') {
    throw new AppError({
      code: 'ALREADY_SUBSCRIBED',
      message: 'Assinatura já está ativa para este espaço',
      statusCode: 409,
    });
  }

  if (clinic.subscription_status !== 'trialing') {
    throw new AppError({
      code: 'CHECKOUT_NOT_ALLOWED',
      message: 'Checkout disponível apenas durante o período de trial inicial',
      statusCode: 403,
    });
  }

  const isSolo =
    clinic.is_solo_professional === true || clinic.account_type === 'solo';
  assertPlanAllowedForAccount(payload.plan_id, isSolo);

  await new Promise((resolve) => setTimeout(resolve, BYPASS_DELAY_MS));

  const trialEndsAt = clinic.trial_ends_at
    ? new Date(clinic.trial_ends_at as string)
    : computeTrialEndsAt();
  const trialEndsIso = trialEndsAt.toISOString();

  const { error: updateError } = await supabase
    .from('clinics')
    .update({
      subscription_plan: payload.plan_id,
      subscription_status: 'trial_active',
      payment_method_on_file: true,
      trial_ends_at: trialEndsIso,
    })
    .eq('id', clinicId);

  if (updateError) {
    throw new AppError({
      code: 'CHECKOUT_UPDATE_FAILED',
      message: updateError.message,
      statusCode: 500,
    });
  }

  await applyPlanoToClinicSettings(clinicId, payload.plan_id);

  await supabase.from('clinic_subscriptions').insert({
    clinic_id: clinicId,
    plan: payload.plan_id,
    status: 'trial_active',
    started_at: new Date().toISOString(),
    ends_at: trialEndsIso,
    metadata: {
      bypass: true,
      initiated_by: caller.id,
      plan_selected_at_checkout: payload.plan_id,
    },
  });

  return {
    clinic_id: clinicId,
    plan_id: payload.plan_id,
    subscription_status: 'trial_active',
    payment_method_on_file: true,
    trial_ends_at: trialEndsIso,
  };
}
