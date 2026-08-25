import { AppError } from './errors.ts';
import {
  defaultStripeTestLookupKey,
  getStripeClient,
  isStripeMissingResourceError,
  resolveStripePriceId,
  stripeAddonLookupKey,
  stripePlanLookupKey,
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

  const dbColumn =
    cycle === 'yearly'
      ? (mode === 'live' ? 'stripe_price_id_live_anual' : 'stripe_price_id_test_anual')
      : (mode === 'live' ? 'stripe_price_id_live' : 'stripe_price_id_test');
  const fromDb = plano[dbColumn] as string | null;

  const resolved = await resolvePriceIdFromDbOrLookup({
    stripe,
    fromDb,
    lookupKey: stripePlanLookupKey(planId, cycle),
  });

  if (resolved) {
    if (resolved !== fromDb) {
      await supabase.from('planos').update({ [dbColumn]: resolved }).eq('id', planId);
    }
    return { priceId: resolved, mode };
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

async function resolvePriceIdFromDbOrLookup(params: {
  stripe: ReturnType<typeof getStripeClient>;
  fromDb: string | null;
  lookupKey: string;
}): Promise<string | null> {
  if (params.fromDb) {
    try {
      const price = await params.stripe.prices.retrieve(params.fromDb);
      if (price?.id && price.active !== false) return price.id;
    } catch (error) {
      if (!isStripeMissingResourceError(error)) throw error;
    }
  }

  const byLookup = await params.stripe.prices.list({ lookup_keys: [params.lookupKey], limit: 1 });
  return byLookup.data[0]?.id ?? null;
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

  const dbColumn =
    cycle === 'yearly'
      ? (mode === 'live' ? 'stripe_price_id_live_anual' : 'stripe_price_id_test_anual')
      : (mode === 'live' ? 'stripe_price_id_live_mensal' : 'stripe_price_id_test_mensal');
  const fromDb = (addon[dbColumn] as string | null) ?? null;
  const stripe = getStripeClient(mode);
  const priceId = await resolvePriceIdFromDbOrLookup({
    stripe,
    fromDb,
    lookupKey: stripeAddonLookupKey(addonId, cycle),
  });

  if (!priceId) {
    throw new AppError({
      code: 'STRIPE_PRICE_NOT_CONFIGURED',
      message: `Preço Stripe não configurado para o módulo "${addonId}" (modo ${mode}, ciclo ${cycle}).`,
      statusCode: 404,
    });
  }

  if (priceId !== fromDb) {
    await supabase.from('plan_addons').update({ [dbColumn]: priceId }).eq('id', addonId);
  }

  return {
    addonId: addon.id as string,
    priceId,
    mode,
    pacientesBonus: Number(addon.pacientes_bonus),
    precoMensalCents: Number(addon.preco_mensal_cents),
    precoAnualMensalCents: addon.preco_anual_mensal_cents
      ? Number(addon.preco_anual_mensal_cents)
      : null,
  };
}
