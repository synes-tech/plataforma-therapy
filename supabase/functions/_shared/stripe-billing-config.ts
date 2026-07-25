import { AppError } from './errors.ts';
import {
  defaultStripeTestLookupKey,
  getStripeClient,
  resolveStripePriceId,
  type StripeBillingMode,
} from './stripe.ts';
import { createServiceClient } from './supabase.ts';

export function assertStripeBillingEnabled(): void {
  if (Deno.env.get('STRIPE_BILLING_ENABLED') !== 'true') {
    throw new AppError({
      code: 'STRIPE_BILLING_DISABLED',
      message: 'Checkout Stripe desabilitado neste ambiente.',
      statusCode: 503,
    });
  }
}

export function getStripeBillingMode(): StripeBillingMode {
  return Deno.env.get('STRIPE_BILLING_MODE') === 'live' ? 'live' : 'test';
}

export function billingWebhookSecretForMode(mode: StripeBillingMode): string {
  const specific = Deno.env.get(
    mode === 'live' ? 'STRIPE_BILLING_WEBHOOK_SECRET_LIVE' : 'STRIPE_BILLING_WEBHOOK_SECRET_TEST',
  );
  const fallback = Deno.env.get('STRIPE_BILLING_WEBHOOK_SECRET');
  const secret = specific ?? fallback;

  if (!secret) {
    throw new AppError({
      code: 'STRIPE_WEBHOOK_NOT_CONFIGURED',
      message: 'STRIPE_BILLING_WEBHOOK_SECRET não configurado.',
      statusCode: 503,
    });
  }

  return secret;
}

const LEGACY_THERAPIST_PLANS = new Set(['inicial', 'intermediario']);

export type BillingCycle = 'monthly' | 'yearly';

/** Módulo Adicional aplicável a cada plano pago (v2). */
export function addonIdForPlan(planId: string): 'modulo_sa' | 'modulo_p' | null {
  if (planId === 'standard' || planId === 'advanced') return 'modulo_sa';
  if (planId === 'premium') return 'modulo_p';
  return null;
}

export async function resolveBillingPriceId(
  planId: string,
  cycle: BillingCycle = 'monthly',
): Promise<{
  priceId: string;
  mode: StripeBillingMode;
}> {
  const mode = getStripeBillingMode();
  const supabase = createServiceClient();
  const stripe = getStripeClient(mode);

  const { data: plano, error } = await supabase
    .from('planos')
    .select(
      'id, stripe_price_id_test, stripe_price_id_live, stripe_price_id_test_anual, stripe_price_id_live_anual, preco_anual_mensal_cents',
    )
    .eq('id', planId)
    .eq('ativo', true)
    .maybeSingle();

  if (error || !plano) {
    throw new AppError({
      code: 'PLAN_NOT_FOUND',
      message: 'Plano não encontrado no catálogo.',
      statusCode: 404,
    });
  }

  if (cycle === 'yearly' && !plano.preco_anual_mensal_cents) {
    throw new AppError({
      code: 'PLAN_NO_YEARLY_CYCLE',
      message: `O plano "${planId}" não possui ciclo anual.`,
      statusCode: 400,
    });
  }

  const fromDb =
    cycle === 'yearly'
      ? (mode === 'live' ? plano.stripe_price_id_live_anual : plano.stripe_price_id_test_anual)
      : (mode === 'live' ? plano.stripe_price_id_live : plano.stripe_price_id_test);

  if (fromDb) {
    return { priceId: fromDb as string, mode };
  }

  if (cycle === 'monthly' && LEGACY_THERAPIST_PLANS.has(planId)) {
    const priceId = await resolveStripePriceId(
      stripe,
      mode,
      planId as 'inicial' | 'intermediario',
      mode === 'test' ? defaultStripeTestLookupKey(planId as 'inicial' | 'intermediario') : undefined,
    );
    return { priceId, mode };
  }

  throw new AppError({
    code: 'STRIPE_PRICE_NOT_CONFIGURED',
    message: `Preço Stripe não configurado para o plano "${planId}" (modo ${mode}, ciclo ${cycle}).`,
    statusCode: 404,
  });
}

export interface AddonPriceInfo {
  addonId: string;
  priceId: string;
  mode: StripeBillingMode;
  pacientesBonus: number;
  precoMensalCents: number;
  precoAnualMensalCents: number | null;
}

export async function resolveAddonPriceId(
  addonId: string,
  cycle: BillingCycle = 'monthly',
): Promise<AddonPriceInfo> {
  const mode = getStripeBillingMode();
  const supabase = createServiceClient();

  const { data: addon, error } = await supabase
    .from('plan_addons')
    .select(
      'id, pacientes_bonus, preco_mensal_cents, preco_anual_mensal_cents, stripe_price_id_test_mensal, stripe_price_id_test_anual, stripe_price_id_live_mensal, stripe_price_id_live_anual',
    )
    .eq('id', addonId)
    .eq('ativo', true)
    .maybeSingle();

  if (error || !addon) {
    throw new AppError({
      code: 'ADDON_NOT_FOUND',
      message: 'Módulo Adicional não encontrado no catálogo.',
      statusCode: 404,
    });
  }

  const priceId =
    cycle === 'yearly'
      ? (mode === 'live' ? addon.stripe_price_id_live_anual : addon.stripe_price_id_test_anual)
      : (mode === 'live' ? addon.stripe_price_id_live_mensal : addon.stripe_price_id_test_mensal);

  if (!priceId) {
    throw new AppError({
      code: 'STRIPE_PRICE_NOT_CONFIGURED',
      message: `Preço Stripe não configurado para o módulo "${addonId}" (modo ${mode}, ciclo ${cycle}).`,
      statusCode: 404,
    });
  }

  return {
    addonId: addon.id as string,
    priceId: priceId as string,
    mode,
    pacientesBonus: Number(addon.pacientes_bonus),
    precoMensalCents: Number(addon.preco_mensal_cents),
    precoAnualMensalCents: addon.preco_anual_mensal_cents
      ? Number(addon.preco_anual_mensal_cents)
      : null,
  };
}
