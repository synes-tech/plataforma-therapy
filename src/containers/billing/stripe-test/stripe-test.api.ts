import { callPublicFunction } from '@shared/lib/api';
import type { StripeBillingMode, StripeCheckoutPlanId } from './stripe-billing.constants';

export interface StripeCheckoutSessionResult {
  url: string;
  session_id: string;
  mode: StripeBillingMode;
  plan_id: StripeCheckoutPlanId;
  price_id: string;
}

export interface StripePortalSessionResult {
  url: string;
}

export interface StripePublicConfig {
  test_publishable_key: string | null;
  live_publishable_key: string | null;
  live_checkout_enabled: boolean;
}

export async function fetchStripePublicConfig(): Promise<StripePublicConfig> {
  return callPublicFunction<StripePublicConfig>('stripe-test-public-config', {});
}

export async function createStripeCheckoutSession(input: {
  mode: StripeBillingMode;
  planId: StripeCheckoutPlanId;
  lookupKey?: string;
}): Promise<StripeCheckoutSessionResult> {
  return callPublicFunction<StripeCheckoutSessionResult>('stripe-test-create-checkout', {
    mode: input.mode,
    plan_id: input.planId,
    ...(input.lookupKey ? { lookup_key: input.lookupKey } : {}),
  });
}

export async function createStripePortalSession(input: {
  mode: StripeBillingMode;
  sessionId: string;
}): Promise<StripePortalSessionResult> {
  return callPublicFunction<StripePortalSessionResult>('stripe-test-create-portal', {
    mode: input.mode,
    session_id: input.sessionId,
  });
}
