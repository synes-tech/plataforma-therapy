import Stripe from 'npm:stripe@17.7.0';
import { AppError } from './errors.ts';
import { originFromRequest, resolveStripeReturnOrigin } from './stripe-return-origin.ts';

export type StripeBillingMode = 'test' | 'live';
export type StripeCheckoutPlanId = 'inicial' | 'intermediario' | 'teste_1_real';

/** @deprecated use StripeCheckoutPlanId */
export type StripeTherapistPlanId = StripeCheckoutPlanId;

const LIVE_ONLY_PLANS = new Set<StripeCheckoutPlanId>(['teste_1_real']);

export function assertPlanAllowedForMode(mode: StripeBillingMode, planId: StripeCheckoutPlanId): void {
  if (LIVE_ONLY_PLANS.has(planId) && mode !== 'live') {
    throw new AppError({
      code: 'PLAN_LIVE_ONLY',
      message: 'Este produto só está disponível no modo produção.',
      statusCode: 403,
    });
  }
}

export function stripeCheckoutSessionMode(planId: StripeCheckoutPlanId): 'subscription' | 'payment' {
  return planId === 'teste_1_real' ? 'payment' : 'subscription';
}

const clientCache = new Map<StripeBillingMode, Stripe>();

export function assertStripeTestPageEnabled(): void {
  if (Deno.env.get('STRIPE_TEST_PAGE_ENABLED') !== 'true') {
    throw new AppError({
      code: 'STRIPE_TEST_DISABLED',
      message: 'Página de teste Stripe desabilitada neste ambiente.',
      statusCode: 403,
    });
  }
}

export function assertLiveCheckoutEnabled(): void {
  if (Deno.env.get('STRIPE_LIVE_CHECKOUT_ENABLED') !== 'true') {
    throw new AppError({
      code: 'STRIPE_LIVE_DISABLED',
      message: 'Checkout em produção desabilitado. Defina STRIPE_LIVE_CHECKOUT_ENABLED=true nos secrets.',
      statusCode: 403,
    });
  }
}

function secretKeyForMode(mode: StripeBillingMode): string {
  if (mode === 'live') {
    const liveKey = Deno.env.get('STRIPE_LIVE_SECRET_KEY');
    if (!liveKey) {
      throw new AppError({
        code: 'STRIPE_LIVE_NOT_CONFIGURED',
        message: 'STRIPE_LIVE_SECRET_KEY não configurada no servidor.',
        statusCode: 503,
      });
    }
    return liveKey;
  }

  const testKey = Deno.env.get('STRIPE_TEST_SECRET_KEY') ?? Deno.env.get('STRIPE_SECRET_KEY');
  if (!testKey) {
    throw new AppError({
      code: 'STRIPE_TEST_NOT_CONFIGURED',
      message: 'STRIPE_TEST_SECRET_KEY (ou STRIPE_SECRET_KEY) não configurada no servidor.',
      statusCode: 503,
    });
  }
  return testKey;
}

export function getStripeClient(mode: StripeBillingMode): Stripe {
  const cached = clientCache.get(mode);
  if (cached) return cached;

  const client = new Stripe(secretKeyForMode(mode), {
    apiVersion: '2025-01-27.acacia',
    httpClient: Stripe.createFetchHttpClient(),
  });
  clientCache.set(mode, client);
  return client;
}

/** @deprecated use getStripeClient(mode) */
export function getStripeSecretKey(): string {
  return secretKeyForMode('test');
}

export function getStripeAppOrigin(req: Request): string {
  return resolveStripeReturnOrigin(
    originFromRequest(req),
    Deno.env.get('STRIPE_APP_ORIGIN'),
  );
}

function envKey(mode: StripeBillingMode, planId: StripeCheckoutPlanId, kind: 'PRICE' | 'PRODUCT'): string {
  const prefix = mode === 'live' ? 'STRIPE_LIVE' : 'STRIPE_TEST';
  const plan = planId.toUpperCase();
  return `${prefix}_${kind}_${plan}`;
}

export function productIdForPlan(mode: StripeBillingMode, planId: StripeCheckoutPlanId): string | null {
  const fromEnv = Deno.env.get(envKey(mode, planId, 'PRODUCT'));
  if (fromEnv) return fromEnv;

  if (mode === 'live') {
    const defaults: Record<StripeCheckoutPlanId, string | undefined> = {
      inicial: 'prod_Utlu7cfq4TY1lp',
      intermediario: 'prod_Utlv6MsaI79XxC',
      teste_1_real: 'prod_UtmLX78ZOcMvz5',
    };
    return defaults[planId] ?? null;
  }

  return null;
}

export async function resolveStripePriceId(
  stripe: Stripe,
  mode: StripeBillingMode,
  planId: StripeCheckoutPlanId,
  lookupKey?: string,
): Promise<string> {
  const priceFromEnv = Deno.env.get(envKey(mode, planId, 'PRICE'));
  if (priceFromEnv) return priceFromEnv;

  if (lookupKey) {
    const byLookup = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
    if (byLookup.data[0]?.id) return byLookup.data[0].id;
  }

  const productId = productIdForPlan(mode, planId);
  if (productId) {
    const byProduct = await stripe.prices.list({
      product: productId,
      active: true,
      limit: 10,
    });

    const recurring = byProduct.data.find((p) => p.recurring?.interval === 'month');
    const oneTime = byProduct.data.find((p) => !p.recurring);
    const price = planId === 'teste_1_real' ? (oneTime ?? byProduct.data[0]) : (recurring ?? byProduct.data[0]);
    if (price?.id) return price.id;
  }

  throw new AppError({
    code: 'STRIPE_PRICE_NOT_FOUND',
    message: `Preço não encontrado (${mode}/${planId}). Configure STRIPE_${mode.toUpperCase()}_PRICE_${planId.toUpperCase()} ou o product ID no Dashboard.`,
    statusCode: 404,
  });
}

export function defaultStripeTestLookupKey(planId: StripeCheckoutPlanId): string {
  const specific = Deno.env.get(`STRIPE_TEST_LOOKUP_KEY_${planId.toUpperCase()}`);
  if (specific) return specific;
  return Deno.env.get('STRIPE_TEST_LOOKUP_KEY') ?? `plano_${planId}_mensal`;
}

export function stripePlanLookupKey(planId: string, cycle: 'monthly' | 'yearly'): string {
  return `plano_${planId}_${cycle === 'yearly' ? 'anual' : 'mensal'}`;
}

export function stripeAddonLookupKey(addonId: string, cycle: 'monthly' | 'yearly'): string {
  return `addon_${addonId}_${cycle === 'yearly' ? 'anual' : 'mensal'}`;
}

function stripeErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

export function isStripeMissingResourceError(error: unknown): boolean {
  if (stripeErrorCode(error) === 'resource_missing') return true;
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /No such (customer|price|product)/i.test(message);
}

export function wrapStripeError(error: unknown, fallbackMessage: string): never {
  if (error instanceof AppError) throw error;

  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/No such customer/i.test(message)) {
    throw new AppError({
      code: 'STRIPE_CUSTOMER_INVALID',
      message: 'Cadastro de cobrança inválido neste ambiente. Tente novamente.',
      statusCode: 409,
    });
  }
  if (/No such price/i.test(message) || /price specified is inactive/i.test(message)) {
    throw new AppError({
      code: 'STRIPE_PRICE_NOT_FOUND',
      message: 'Preço do plano não encontrado no Stripe. Recrie o catálogo deste ambiente.',
      statusCode: 404,
    });
  }

  throw new AppError({
    code: 'STRIPE_CHECKOUT_FAILED',
    message: fallbackMessage,
    statusCode: 502,
  });
}
