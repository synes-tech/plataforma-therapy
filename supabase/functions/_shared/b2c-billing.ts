/**
 * Billing B2C — Ivy, Acompanhante de Apoio.
 *
 * Produto separado do B2B (ADR-11). O webhook decide o destino pelo
 * `metadata.account_type`: clinic | patient. Sem esse roteamento, uma sessão
 * B2C cairia no provisionamento de clínica e quebraria as duas pontas.
 */
import type Stripe from 'npm:stripe@17.7.0';
import { AppError } from './errors.ts';
import { createServiceClient } from './supabase.ts';
import type { StripeBillingMode } from './stripe.ts';
import {
  invoiceSubscriptionIdFromPayload,
  mapPatientStripeStatus,
  THERY_LOOKUP_KEY,
  unixToIso,
} from './b2c-billing.utils.ts';

export {
  B2B_CHECKOUT_SOURCE,
  B2C_CHECKOUT_SOURCE,
  isPatientAccessStatus,
  mapPatientStripeStatus,
  PATIENT_ACCESS_STATUSES,
  resolveStripeAccountType,
  THERY_AMOUNT_CENTS,
  THERY_LOOKUP_KEY,
  THERY_PLAN_CODE,
  THERY_PLAN_NAME,
  THERY_TRIAL_DAYS,
  unixToIso,
  type StripeAccountType,
} from './b2c-billing.utils.ts';

export function subscriptionPeriod(subscription: Stripe.Subscription): {
  start: string | null;
  end: string | null;
} {
  const item = subscription.items?.data?.[0] as
    | { current_period_start?: number; current_period_end?: number }
    | undefined;
  const start = item?.current_period_start ?? subscription.current_period_start;
  const end = item?.current_period_end ?? subscription.current_period_end;
  return { start: unixToIso(start), end: unixToIso(end) };
}

export function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  return invoiceSubscriptionIdFromPayload(invoice);
}

export function priceIdFromSubscription(subscription: Stripe.Subscription): string | null {
  return subscription.items?.data?.[0]?.price?.id ?? null;
}

export async function resolveTheryPriceId(
  stripe: Stripe,
  mode: StripeBillingMode,
): Promise<string> {
  const prefix = mode === 'live' ? 'STRIPE_LIVE' : 'STRIPE_TEST';
  const fromEnv = Deno.env.get(`${prefix}_PRICE_THERY_APOIO`);
  if (fromEnv) return fromEnv;

  const byLookup = await stripe.prices.list({ lookup_keys: [THERY_LOOKUP_KEY], limit: 1 });
  if (byLookup.data[0]?.id) return byLookup.data[0].id;

  const productId = Deno.env.get(`${prefix}_PRODUCT_THERY_APOIO`);
  if (productId) {
    const byProduct = await stripe.prices.list({ product: productId, active: true, limit: 10 });
    const recurring = byProduct.data.find((price) => price.recurring?.interval === 'month');
    if (recurring?.id) return recurring.id;
  }

  throw new AppError({
    code: 'THERY_PRICE_NOT_FOUND',
    message:
      `Preço da Ivy não encontrado (${mode}). Configure ${prefix}_PRICE_THERY_APOIO ou o lookup ${THERY_LOOKUP_KEY}.`,
    statusCode: 404,
  });
}

export interface PatientSubscriptionUpsert {
  patientId: string;
  clinicId: string;
  portalLinkId?: string | null;
  userId?: string | null;
  customerId: string;
  subscription: Stripe.Subscription;
}

export async function upsertPatientSubscription(input: PatientSubscriptionUpsert): Promise<string> {
  const supabase = createServiceClient();
  const period = subscriptionPeriod(input.subscription);
  const status = mapPatientStripeStatus(input.subscription.status);
  const canceledAt = unixToIso(input.subscription.canceled_at);

  const row = {
    patient_id: input.patientId,
    clinic_id: input.clinicId,
    portal_link_id: input.portalLinkId ?? null,
    user_id: input.userId ?? null,
    plan_code: THERY_LOOKUP_KEY,
    stripe_customer_id: input.customerId,
    stripe_subscription_id: input.subscription.id,
    stripe_price_id: priceIdFromSubscription(input.subscription),
    status,
    trial_start: unixToIso(input.subscription.trial_start),
    trial_end: unixToIso(input.subscription.trial_end),
    current_period_start: period.start,
    current_period_end: period.end,
    cancel_at_period_end: Boolean(input.subscription.cancel_at_period_end),
    canceled_at: canceledAt,
  };

  const { data: existing } = await supabase
    .from('patient_subscriptions')
    .select('id')
    .eq('stripe_subscription_id', input.subscription.id)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from('patient_subscriptions')
      .update(row)
      .eq('id', existing.id);
    if (error) {
      throw new AppError({
        code: 'PATIENT_SUB_UPDATE_FAILED',
        message: error.message,
        statusCode: 500,
      });
    }
    return existing.id as string;
  }

  const { data: byPatient } = await supabase
    .from('patient_subscriptions')
    .select('id')
    .eq('patient_id', input.patientId)
    .in('status', ['incomplete', 'trialing', 'active', 'past_due', 'unpaid'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (byPatient?.id) {
    const { error } = await supabase
      .from('patient_subscriptions')
      .update(row)
      .eq('id', byPatient.id);
    if (error) {
      throw new AppError({
        code: 'PATIENT_SUB_UPDATE_FAILED',
        message: error.message,
        statusCode: 500,
      });
    }
    return byPatient.id as string;
  }

  const { data: created, error } = await supabase
    .from('patient_subscriptions')
    .insert(row)
    .select('id')
    .single();

  if (error || !created) {
    throw new AppError({
      code: 'PATIENT_SUB_INSERT_FAILED',
      message: error?.message ?? 'Falha ao gravar assinatura B2C',
      statusCode: 500,
    });
  }

  return created.id as string;
}

export async function findPatientSubscriptionRefs(
  customerId: string | null | undefined,
  subscriptionId: string | null | undefined,
): Promise<{
  id: string;
  patient_id: string;
  clinic_id: string;
  user_id: string | null;
  portal_link_id: string | null;
} | null> {
  const supabase = createServiceClient();

  if (subscriptionId) {
    const { data } = await supabase
      .from('patient_subscriptions')
      .select('id, patient_id, clinic_id, user_id, portal_link_id')
      .eq('stripe_subscription_id', subscriptionId)
      .maybeSingle();
    if (data) return data as never;
  }

  if (customerId) {
    const { data } = await supabase
      .from('patient_subscriptions')
      .select('id, patient_id, clinic_id, user_id, portal_link_id')
      .eq('stripe_customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as never;
  }

  return null;
}

export async function claimStripeWebhookEvent(params: {
  eventId: string;
  eventType: string;
  accountType: import('./b2c-billing.utils.ts').StripeAccountType;
  livemode: boolean;
}): Promise<'claimed' | 'duplicate'> {
  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from('stripe_webhook_events')
    .select('event_id, status, attempts')
    .eq('event_id', params.eventId)
    .maybeSingle();

  if (existing) {
    if (existing.status === 'processed') return 'duplicate';
    await supabase
      .from('stripe_webhook_events')
      .update({
        status: 'received',
        attempts: Number(existing.attempts ?? 0) + 1,
        error: null,
        account_type: params.accountType,
      })
      .eq('event_id', params.eventId);
    return 'claimed';
  }

  const { error } = await supabase.from('stripe_webhook_events').insert({
    event_id: params.eventId,
    event_type: params.eventType,
    account_type: params.accountType,
    livemode: params.livemode,
    status: 'received',
    attempts: 1,
  });

  if (error?.code === '23505') return 'duplicate';
  if (error) {
    console.error('[stripe-webhook] falha ao gravar idempotência', error);
  }
  return 'claimed';
}

export async function markStripeWebhookEvent(
  eventId: string,
  status: 'processed' | 'failed' | 'ignored',
  errorMessage?: string,
): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from('stripe_webhook_events')
    .update({
      status,
      error: errorMessage ?? null,
      processed_at: status === 'processed' ? new Date().toISOString() : null,
    })
    .eq('event_id', eventId);
}
