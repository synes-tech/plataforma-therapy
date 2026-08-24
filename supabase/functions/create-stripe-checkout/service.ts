import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ForbiddenError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import { requiresPaywall } from '../_shared/paywall.ts';
import { isUserBillingExempt } from '../_shared/billing-exempt.ts';
import { getStripeAppOrigin, getStripeClient } from '../_shared/stripe.ts';
import {
  addonIdForPlan,
  assertStripeBillingEnabled,
  resolveAddonPriceId,
  resolveBillingPriceId,
} from '../_shared/stripe-billing-config.ts';
import { TRIAL_DAYS } from '../_shared/trial.ts';
import type { CreateStripeCheckoutPayload } from './schema.ts';
import type { CreateStripeCheckoutResponse } from './types.ts';

const SOLO_PLANS = new Set([
  'standard',
  'advanced',
  'premium',
  // legado (contas antigas ainda podem migrar)
  'inicial',
  'intermediario',
  'consultorio',
]);
const CORPORATE_PLANS = new Set(['starter', 'professional', 'enterprise']);

function assertPlanAllowedForAccount(planId: string, isSolo: boolean): void {
  if (planId === 'free') {
    throw new AppError({
      code: 'PLAN_NOT_CHECKOUTABLE',
      message: 'O plano Free é gratuito e não passa por checkout.',
      statusCode: 400,
    });
  }
  const allowed = isSolo ? SOLO_PLANS : CORPORATE_PLANS;
  if (!allowed.has(planId)) {
    throw new AppError({
      code: 'PLAN_NOT_ALLOWED',
      message: 'Plano incompatível com o perfil da conta',
      statusCode: 403,
    });
  }
}

async function getOrCreateStripeCustomer(
  clinic: { id: string; email: string; name: string; stripe_customer_id: string | null },
  stripe: ReturnType<typeof getStripeClient>,
): Promise<string> {
  if (clinic.stripe_customer_id) {
    return clinic.stripe_customer_id;
  }

  const customer = await stripe.customers.create({
    email: clinic.email,
    name: clinic.name,
    metadata: { clinic_id: clinic.id },
  });

  const supabase = createServiceClient();
  await supabase
    .from('clinics')
    .update({ stripe_customer_id: customer.id })
    .eq('id', clinic.id);

  return customer.id;
}

function assertCheckoutAllowed(
  clinic: {
    subscription_status: string;
    payment_method_on_file: boolean;
    stripe_subscription_id: string | null;
    subscription_plan: string;
  },
  planId: string,
  intent: 'subscribe' | 'plan_change',
): void {
  const billing = {
    subscription_status: clinic.subscription_status,
    payment_method_on_file: Boolean(clinic.payment_method_on_file),
  };

  const hasActiveStripe =
    Boolean(clinic.stripe_subscription_id) &&
    billing.subscription_status === 'active' &&
    billing.payment_method_on_file;

  if (hasActiveStripe && clinic.subscription_plan === planId) {
    throw new AppError({
      code: 'ALREADY_SUBSCRIBED',
      message: 'Você já está neste plano com assinatura Stripe ativa',
      statusCode: 409,
    });
  }

  if (requiresPaywall(billing)) return;
  if (clinic.subscription_status === 'past_due' || clinic.subscription_status === 'canceled') return;

  // Contas no bypass legado (sem sub Stripe) podem migrar para checkout real
  if (!clinic.stripe_subscription_id) return;

  // Upgrade/downgrade via catálogo de planos (Settings → Plano)
  if (intent === 'plan_change' && planId !== clinic.subscription_plan) return;

  throw new AppError({
    code: 'CHECKOUT_NOT_ALLOWED',
    message: 'Checkout disponível apenas quando o paywall exige assinatura ou troca de plano',
    statusCode: 403,
  });
}

export async function createStripeCheckout(
  payload: CreateStripeCheckoutPayload,
  caller: AuthenticatedUser,
  req: Request,
): Promise<CreateStripeCheckoutResponse> {
  assertStripeBillingEnabled();

  if (!caller.clinic_id) {
    throw new ForbiddenError('Usuário sem clínica associada');
  }

  if (await isUserBillingExempt(caller)) {
    throw new AppError({
      code: 'BILLING_EXEMPT',
      message: 'Esta conta é administrativa da plataforma e não utiliza checkout ou cobrança.',
      statusCode: 403,
    });
  }

  const clinicId = caller.clinic_id;
  const supabase = createServiceClient();

  const { data: clinic, error: clinicError } = await supabase
    .from('clinics')
    .select(
      'id, name, email, subscription_plan, subscription_status, payment_method_on_file, is_solo_professional, account_type, stripe_customer_id, stripe_subscription_id, trial_used',
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

  const billing = {
    subscription_status: clinic.subscription_status as string,
    payment_method_on_file: Boolean(clinic.payment_method_on_file),
  };

  assertCheckoutAllowed(
    {
      subscription_status: billing.subscription_status,
      payment_method_on_file: billing.payment_method_on_file,
      stripe_subscription_id: (clinic.stripe_subscription_id as string | null) ?? null,
      subscription_plan: clinic.subscription_plan as string,
    },
    payload.plan_id,
    payload.intent ?? 'subscribe',
  );

  const isSolo =
    clinic.is_solo_professional === true || clinic.account_type === 'solo';
  assertPlanAllowedForAccount(payload.plan_id, isSolo);

  const billingCycle = payload.billing_cycle ?? 'monthly';
  const { priceId, mode } = await resolveBillingPriceId(payload.plan_id, billingCycle);
  const stripe = getStripeClient(mode);
  const origin = getStripeAppOrigin(req);
  const customerId = await getOrCreateStripeCustomer(
    {
      id: clinic.id as string,
      email: clinic.email as string,
      name: clinic.name as string,
      stripe_customer_id: (clinic.stripe_customer_id as string | null) ?? null,
    },
    stripe,
  );

  // Módulos Adicionais (+5 pacientes cada) no mesmo checkout/ciclo
  const lineItems: Array<{ price: string; quantity: number }> = [
    { price: priceId, quantity: 1 },
  ];
  const addonQuantity = payload.addon_quantity ?? 0;
  if (addonQuantity > 0) {
    const addonId = addonIdForPlan(payload.plan_id);
    if (!addonId) {
      throw new AppError({
        code: 'ADDON_NOT_AVAILABLE',
        message: 'Módulos Adicionais não estão disponíveis para este plano.',
        statusCode: 400,
      });
    }
    const addon = await resolveAddonPriceId(addonId, billingCycle);
    lineItems.push({ price: addon.priceId, quantity: addonQuantity });
  }

  // Trial de 14 dias com cartão — concedido uma única vez por clínica
  const grantTrial = clinic.trial_used !== true;

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    billing_address_collection: 'auto',
    line_items: lineItems,
    mode: 'subscription',
    allow_promotion_codes: true,
    payment_method_collection: 'always',
    success_url:
      `${origin}/checkout/return?success=1&session_id={CHECKOUT_SESSION_ID}&plan=${payload.plan_id}`,
    cancel_url: `${origin}/checkout/return?canceled=1&plan=${payload.plan_id}`,
    metadata: {
      source: 'unithery_billing',
      account_type: 'clinic',
      clinic_id: clinicId,
      plan_id: payload.plan_id,
      user_id: caller.id,
      stripe_mode: mode,
      billing_cycle: billingCycle,
      addon_quantity: String(addonQuantity),
      trial_granted: grantTrial ? 'true' : 'false',
    },
    subscription_data: {
      ...(grantTrial ? { trial_period_days: TRIAL_DAYS } : {}),
      metadata: {
        account_type: 'clinic',
        clinic_id: clinicId,
        plan_id: payload.plan_id,
        billing_cycle: billingCycle,
      },
    },
  });

  if (!session.url) {
    throw new AppError({
      code: 'STRIPE_SESSION_URL_MISSING',
      message: 'Stripe não retornou URL da sessão de checkout.',
      statusCode: 500,
    });
  }

  return {
    url: session.url,
    session_id: session.id,
    plan_id: payload.plan_id,
    price_id: priceId,
    mode,
    billing_cycle: billingCycle,
    trial_granted: grantTrial,
    trial_days: grantTrial ? TRIAL_DAYS : 0,
  };
}
