import type Stripe from 'npm:stripe@17.7.0';
import { createServiceClient } from './supabase.ts';
import { applyPlanoToClinicSettings } from './plan-quotas.ts';
import { AppError } from './errors.ts';
import { isClinicBillingExempt } from './billing-exempt.ts';

export type DbSubscriptionStatus =
  | 'trialing'
  | 'trial_active'
  | 'active'
  | 'past_due'
  | 'canceled';

export function mapStripeSubscriptionStatus(stripeStatus: string): DbSubscriptionStatus | null {
  switch (stripeStatus) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trial_active';
    case 'past_due':
      return 'past_due';
    case 'canceled':
    case 'unpaid':
      return 'canceled';
    case 'incomplete':
    case 'incomplete_expired':
      // Transitório durante checkout — ignorar para não sobrescrever active
      return null;
    default:
      return 'past_due';
  }
}

export function isTransientStripeSubscriptionStatus(stripeStatus: string): boolean {
  return stripeStatus === 'incomplete' || stripeStatus === 'incomplete_expired';
}

export function paymentMethodOnFileForStatus(status: DbSubscriptionStatus): boolean {
  return status === 'active' || status === 'trial_active';
}

export interface ProvisionClinicParams {
  clinicId: string;
  planId: string;
  customerId: string;
  subscriptionId: string | null;
  dbStatus: DbSubscriptionStatus;
  source: string;
  stripeEventId?: string;
  initiatedByUserId?: string;
  billingCycle?: 'monthly' | 'yearly';
  trialEndsAt?: string | null;
  commitmentEndsAt?: string | null;
  markTrialUsed?: boolean;
  /** Força o valor (ex.: cancel_at_period_end → cartão já revogado, manter false) */
  paymentMethodOnFile?: boolean;
}

export async function provisionClinicFromStripe(
  params: ProvisionClinicParams,
): Promise<void> {
  const supabase = createServiceClient();
  const paymentOnFile =
    params.paymentMethodOnFile ?? paymentMethodOnFileForStatus(params.dbStatus);

  const updatePayload: Record<string, unknown> = {
    subscription_plan: params.planId,
    subscription_status: params.dbStatus,
    payment_method_on_file: paymentOnFile,
    stripe_customer_id: params.customerId,
  };

  if (params.subscriptionId) {
    updatePayload.stripe_subscription_id = params.subscriptionId;
  }
  if (params.billingCycle) {
    updatePayload.billing_cycle = params.billingCycle;
  }
  if (params.trialEndsAt !== undefined) {
    updatePayload.trial_ends_at = params.trialEndsAt;
    if (params.trialEndsAt) {
      updatePayload.trial_ending_email_sent_at = null;
    }
  }
  if (params.commitmentEndsAt !== undefined) {
    updatePayload.commitment_ends_at = params.commitmentEndsAt;
  }
  if (params.markTrialUsed) {
    updatePayload.trial_used = true;
  }

  const { error: updateError } = await supabase
    .from('clinics')
    .update(updatePayload)
    .eq('id', params.clinicId)
    .is('deleted_at', null);

  if (updateError) {
    throw new AppError({
      code: 'CLINIC_BILLING_UPDATE_FAILED',
      message: updateError.message,
      statusCode: 500,
    });
  }

  await applyPlanoToClinicSettings(params.clinicId, params.planId);

  await supabase.from('clinic_subscriptions').insert({
    clinic_id: params.clinicId,
    plan: params.planId,
    status: params.dbStatus,
    started_at: new Date().toISOString(),
    metadata: {
      stripe: true,
      source: params.source,
      stripe_event_id: params.stripeEventId ?? null,
      initiated_by: params.initiatedByUserId ?? null,
      stripe_customer_id: params.customerId,
      stripe_subscription_id: params.subscriptionId,
    },
  });
}

export async function findClinicByStripeRefs(
  customerId: string | null | undefined,
  subscriptionId: string | null | undefined,
): Promise<{ id: string; subscription_plan: string } | null> {
  const supabase = createServiceClient();

  if (subscriptionId) {
    const { data } = await supabase
      .from('clinics')
      .select('id, subscription_plan')
      .eq('stripe_subscription_id', subscriptionId)
      .is('deleted_at', null)
      .maybeSingle();
    if (data) return data as { id: string; subscription_plan: string };
  }

  if (customerId) {
    const { data } = await supabase
      .from('clinics')
      .select('id, subscription_plan')
      .eq('stripe_customer_id', customerId)
      .is('deleted_at', null)
      .maybeSingle();
    if (data) return data as { id: string; subscription_plan: string };
  }

  return null;
}

export async function syncClinicFromStripeSubscription(
  clinicId: string,
  subscription: Stripe.Subscription,
  source: string,
): Promise<boolean> {
  const planId =
    (subscription.metadata?.plan_id as string | undefined) ??
    undefined;

  const { data: clinic } = await createServiceClient()
    .from('clinics')
    .select('subscription_plan, commitment_ends_at')
    .eq('id', clinicId)
    .maybeSingle();

  const resolvedPlanId = planId ?? (clinic?.subscription_plan as string);

  const dbStatus = mapStripeSubscriptionStatus(subscription.status);
  if (!dbStatus) {
    console.log(`[stripe-billing] skip transient subscription status=${subscription.status}`);
    return false;
  }

  // Assinatura encerrada de vez (cancelamento/inadimplência esgotada) → FREE
  if (dbStatus === 'canceled') {
    await downgradeClinicToFree(clinicId, source);
    return true;
  }

  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id ?? '';

  const billingCycle =
    (subscription.metadata?.billing_cycle as 'monthly' | 'yearly' | undefined) ?? undefined;

  // Compromisso anual (12x emulado): renova automaticamente ao expirar com assinatura ativa
  let commitmentEndsAt: string | null | undefined = undefined;
  if (billingCycle === 'yearly') {
    const current = clinic?.commitment_ends_at
      ? new Date(clinic.commitment_ends_at as string)
      : null;
    if (!current || current.getTime() < Date.now()) {
      commitmentEndsAt = computeCommitmentEnd(
        subscription.trial_end ? new Date(subscription.trial_end * 1000) : new Date(),
      ).toISOString();
    }
  } else if (billingCycle === 'monthly') {
    commitmentEndsAt = null;
  }

  await provisionClinicFromStripe({
    clinicId,
    planId: resolvedPlanId,
    customerId,
    subscriptionId: subscription.id,
    dbStatus,
    source,
    billingCycle,
    commitmentEndsAt,
    trialEndsAt:
      dbStatus === 'trial_active' && subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : undefined,
    markTrialUsed: dbStatus === 'trial_active' || dbStatus === 'active',
    // Cancelamento agendado (fim do período): o cartão foi revogado na
    // plataforma — não re-marcar payment_method_on_file como true.
    paymentMethodOnFile: subscription.cancel_at_period_end ? false : undefined,
  });

  await syncAddonsFromSubscription(clinicId, subscription);

  return true;
}

export function computeCommitmentEnd(from: Date): Date {
  const end = new Date(from);
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  return end;
}

/**
 * Sincroniza os Módulos Adicionais (subscription items de addon) da assinatura
 * Stripe para clinic_addons e reflete o bônus em professionals.patient_quota_bonus.
 */
export async function syncAddonsFromSubscription(
  clinicId: string,
  subscription: Stripe.Subscription,
): Promise<void> {
  const supabase = createServiceClient();

  const { data: addonCatalog } = await supabase
    .from('plan_addons')
    .select(
      'id, stripe_price_id_test_mensal, stripe_price_id_test_anual, stripe_price_id_live_mensal, stripe_price_id_live_anual',
    );

  if (!addonCatalog?.length) return;

  const priceToAddon = new Map<string, { addonId: string; cycle: 'monthly' | 'yearly' }>();
  for (const addon of addonCatalog) {
    const entries: Array<[string | null, 'monthly' | 'yearly']> = [
      [addon.stripe_price_id_test_mensal as string | null, 'monthly'],
      [addon.stripe_price_id_live_mensal as string | null, 'monthly'],
      [addon.stripe_price_id_test_anual as string | null, 'yearly'],
      [addon.stripe_price_id_live_anual as string | null, 'yearly'],
    ];
    for (const [priceId, cycle] of entries) {
      if (priceId) priceToAddon.set(priceId, { addonId: addon.id as string, cycle });
    }
  }

  const items = subscription.items?.data ?? [];
  const activeAddonItems = new Map<
    string,
    { quantity: number; itemId: string; cycle: 'monthly' | 'yearly' }
  >();

  for (const item of items) {
    const priceId = typeof item.price === 'string' ? item.price : item.price?.id;
    if (!priceId) continue;
    const match = priceToAddon.get(priceId);
    if (!match) continue;
    activeAddonItems.set(match.addonId, {
      quantity: item.quantity ?? 1,
      itemId: item.id,
      cycle: match.cycle,
    });
  }

  const subscriptionEnded =
    subscription.status === 'canceled' || subscription.status === 'unpaid';

  for (const addon of addonCatalog) {
    const addonId = addon.id as string;
    const active = subscriptionEnded ? undefined : activeAddonItems.get(addonId);

    if (active) {
      const { data: existing } = await supabase
        .from('clinic_addons')
        .select('id')
        .eq('clinic_id', clinicId)
        .eq('addon_id', addonId)
        .eq('status', 'active')
        .maybeSingle();

      if (existing?.id) {
        await supabase
          .from('clinic_addons')
          .update({
            quantidade: active.quantity,
            billing_cycle: active.cycle,
            stripe_subscription_item_id: active.itemId,
          })
          .eq('id', existing.id);
      } else {
        await supabase.from('clinic_addons').insert({
          clinic_id: clinicId,
          addon_id: addonId,
          quantidade: active.quantity,
          billing_cycle: active.cycle,
          stripe_subscription_item_id: active.itemId,
          status: 'active',
        });
      }
    } else {
      await supabase
        .from('clinic_addons')
        .update({ status: 'canceled', canceled_at: new Date().toISOString() })
        .eq('clinic_id', clinicId)
        .eq('addon_id', addonId)
        .eq('status', 'active');
    }
  }

  await supabase.rpc('sync_patient_quota_bonus_from_addons', { p_clinic_id: clinicId });
  await supabase.rpc('sync_clinic_settings_from_plano', { p_clinic_id: clinicId });
}

/**
 * Downgrade definitivo para o plano FREE (cancelamento efetivado ou
 * inadimplência com tentativas esgotadas). Dados clínicos são preservados;
 * pacientes acima do limite ficam bloqueados para novas ações pelas cotas.
 */
export async function downgradeClinicToFree(
  clinicId: string,
  source: string,
  stripeEventId?: string,
): Promise<void> {
  if (await isClinicBillingExempt(clinicId)) {
    console.log(`[stripe-billing] skip downgrade — billing_exempt clinic=${clinicId}`);
    return;
  }

  const supabase = createServiceClient();

  const { error } = await supabase
    .from('clinics')
    .update({
      subscription_plan: 'free',
      subscription_status: 'canceled',
      payment_method_on_file: false,
      stripe_subscription_id: null,
      billing_cycle: 'monthly',
      commitment_ends_at: null,
      stripe_schedule_id: null,
      downgraded_at: new Date().toISOString(),
    })
    .eq('id', clinicId)
    .is('deleted_at', null);

  if (error) {
    throw new AppError({
      code: 'CLINIC_DOWNGRADE_FAILED',
      message: error.message,
      statusCode: 500,
    });
  }

  await supabase
    .from('clinic_addons')
    .update({ status: 'canceled', canceled_at: new Date().toISOString() })
    .eq('clinic_id', clinicId)
    .eq('status', 'active');

  await supabase.rpc('sync_patient_quota_bonus_from_addons', { p_clinic_id: clinicId });
  await applyPlanoToClinicSettings(clinicId, 'free');

  await supabase.from('clinic_subscriptions').insert({
    clinic_id: clinicId,
    plan: 'free',
    status: 'canceled',
    metadata: {
      stripe: true,
      source,
      stripe_event_id: stripeEventId ?? null,
      downgrade_to_free: true,
    },
  });

  console.log(`[stripe-billing] downgrade para FREE clinic=${clinicId} source=${source}`);
}
