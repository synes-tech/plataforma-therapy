import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ForbiddenError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import { getStripeClient } from '../_shared/stripe.ts';
import {
  addonIdForPlan,
  assertStripeBillingEnabled,
  getStripeBillingMode,
  resolveAddonPriceId,
} from '../_shared/stripe-billing-config.ts';
import { syncAddonsFromSubscription } from '../_shared/stripe-billing-provision.ts';
import { isUserBillingExempt } from '../_shared/billing-exempt.ts';
import type {
  PurchasePatientQuotaPackPayload,
  PurchasePatientQuotaPackResponse,
} from './types.ts';

const SOLO_PLANS = new Set(['standard', 'advanced', 'premium']);

/**
 * Compra de Módulo Adicional (+5 pacientes, +20 sessões, +375 IA/mês).
 * v2: cobrança real via Stripe — adiciona/incrementa um subscription item
 * na assinatura existente, com proração cobrada imediatamente.
 */
export async function purchasePatientQuotaPack(
  payload: PurchasePatientQuotaPackPayload,
  caller: AuthenticatedUser,
): Promise<PurchasePatientQuotaPackResponse> {
  assertStripeBillingEnabled();

  if (!caller.clinic_id) {
    throw new ForbiddenError('Usuário sem clínica associada');
  }

  if (await isUserBillingExempt(caller)) {
    throw new AppError({
      code: 'BILLING_EXEMPT',
      message: 'Conta administrativa — limites de pacientes já são ilimitados.',
      statusCode: 409,
    });
  }

  const clinicId = caller.clinic_id;
  const supabase = createServiceClient();

  const { data: clinic, error: clinicError } = await supabase
    .from('clinics')
    .select(
      'id, subscription_plan, subscription_status, payment_method_on_file, is_solo_professional, billing_cycle, stripe_subscription_id',
    )
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

  const planId = clinic.subscription_plan as string;

  if (!SOLO_PLANS.has(planId)) {
    throw new AppError({
      code: 'PACK_NOT_AVAILABLE',
      message:
        planId === 'free'
          ? 'Assine um plano pago para contratar Módulos Adicionais de pacientes.'
          : 'Módulos Adicionais estão disponíveis apenas para os planos Standard, Advanced e Premium.',
      statusCode: 403,
    });
  }

  const hasActiveBilling =
    Boolean(clinic.stripe_subscription_id) &&
    ['trial_active', 'active'].includes(clinic.subscription_status as string);

  if (!hasActiveBilling) {
    throw new AppError({
      code: 'BILLING_REQUIRED',
      message: 'Sua assinatura precisa estar ativa para contratar Módulos Adicionais.',
      statusCode: 403,
    });
  }

  const { data: professional, error: profError } = await supabase
    .from('professionals')
    .select('id')
    .eq('clinic_id', clinicId)
    .eq('user_id', caller.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (profError || !professional?.id) {
    throw new AppError({
      code: 'PROFESSIONAL_NOT_FOUND',
      message: 'Profissional não encontrado para esta conta.',
      statusCode: 404,
    });
  }

  const addonId = addonIdForPlan(planId);
  if (!addonId) {
    throw new AppError({
      code: 'ADDON_NOT_AVAILABLE',
      message: 'Módulos Adicionais não estão disponíveis para este plano.',
      statusCode: 400,
    });
  }

  const billingCycle = (clinic.billing_cycle as 'monthly' | 'yearly') ?? 'monthly';
  const addon = await resolveAddonPriceId(addonId, billingCycle);
  const mode = getStripeBillingMode();
  const stripe = getStripeClient(mode);

  const subscriptionId = clinic.stripe_subscription_id as string;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  if (!['active', 'trialing'].includes(subscription.status)) {
    throw new AppError({
      code: 'SUBSCRIPTION_NOT_ACTIVE',
      message: 'Sua assinatura Stripe não está ativa. Regularize o pagamento antes de contratar módulos.',
      statusCode: 409,
    });
  }

  const quantityToAdd = payload.quantity ?? 1;
  const existingItem = subscription.items.data.find((item) => {
    const priceId = typeof item.price === 'string' ? item.price : item.price?.id;
    return priceId === addon.priceId;
  });

  let totalQuantity: number;
  if (existingItem) {
    totalQuantity = (existingItem.quantity ?? 1) + quantityToAdd;
    await stripe.subscriptionItems.update(existingItem.id, {
      quantity: totalQuantity,
      proration_behavior: 'always_invoice',
    });
  } else {
    totalQuantity = quantityToAdd;
    await stripe.subscriptionItems.create({
      subscription: subscriptionId,
      price: addon.priceId,
      quantity: totalQuantity,
      proration_behavior: 'always_invoice',
    });
  }

  // Reflete no banco (clinic_addons + professionals.patient_quota_bonus)
  const updatedSubscription = await stripe.subscriptions.retrieve(subscriptionId);
  await syncAddonsFromSubscription(clinicId, updatedSubscription);

  const { data: profAfter } = await supabase
    .from('professionals')
    .select('patient_quota_bonus')
    .eq('id', professional.id)
    .single();

  const bonusTotal = Number(profAfter?.patient_quota_bonus ?? 0);
  const priceCents =
    billingCycle === 'yearly' && addon.precoAnualMensalCents
      ? addon.precoAnualMensalCents
      : addon.precoMensalCents;

  await supabase.from('audit_logs').insert({
    user_id: caller.id,
    clinic_id: clinicId,
    action: 'billing.patient_addon.purchase',
    resource_type: 'professional',
    resource_id: professional.id,
    metadata: {
      addon_id: addonId,
      quantity_added: quantityToAdd,
      total_quantity: totalQuantity,
      billing_cycle: billingCycle,
      price_cents_per_module: priceCents,
      stripe_subscription_id: subscriptionId,
      stripe_mode: mode,
    },
  });

  return {
    professional_id: professional.id,
    addon_id: addonId,
    quantity_added: quantityToAdd,
    total_quantity: totalQuantity,
    pacientes_bonus_total: totalQuantity * addon.pacientesBonus,
    patient_quota_bonus: bonusTotal,
    billing_cycle: billingCycle,
    price_cents_per_module: priceCents,
    message: `+${quantityToAdd * addon.pacientesBonus} pacientes adicionados ao seu plano (${totalQuantity} módulo(s) ativo(s)).`,
  };
}
