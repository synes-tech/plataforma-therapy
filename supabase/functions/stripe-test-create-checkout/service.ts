import {
  assertLiveCheckoutEnabled,
  assertPlanAllowedForMode,
  assertStripeTestPageEnabled,
  defaultStripeTestLookupKey,
  getStripeAppOrigin,
  getStripeClient,
  resolveStripePriceId,
  stripeCheckoutSessionMode,
} from '../_shared/stripe.ts';
import { AppError } from '../_shared/errors.ts';
import type { StripeTestCreateCheckoutPayload } from './types.ts';

export interface StripeTestCheckoutResult {
  url: string;
  session_id: string;
  mode: 'test' | 'live';
  plan_id: 'inicial' | 'intermediario' | 'teste_1_real';
  price_id: string;
}

export async function stripeTestCreateCheckout(
  payload: StripeTestCreateCheckoutPayload,
  req: Request,
): Promise<StripeTestCheckoutResult> {
  assertStripeTestPageEnabled();

  if (payload.mode === 'live') {
    assertLiveCheckoutEnabled();
  }

  assertPlanAllowedForMode(payload.mode, payload.plan_id);

  const origin = getStripeAppOrigin(req);
  const stripe = getStripeClient(payload.mode);

  const lookupKey =
    payload.mode === 'test' && payload.plan_id !== 'teste_1_real'
      ? payload.lookup_key ?? defaultStripeTestLookupKey(payload.plan_id)
      : payload.lookup_key;

  const priceId = await resolveStripePriceId(stripe, payload.mode, payload.plan_id, lookupKey);
  const checkoutMode = stripeCheckoutSessionMode(payload.plan_id);

  const session = await stripe.checkout.sessions.create({
    billing_address_collection: 'auto',
    line_items: [{ price: priceId, quantity: 1 }],
    mode: checkoutMode,
    success_url:
      `${origin}/unithery/teste?success=true&mode=${payload.mode}&plan=${payload.plan_id}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/unithery/teste?canceled=true&mode=${payload.mode}&plan=${payload.plan_id}`,
    metadata: {
      source: 'unithery_test_page',
      stripe_mode: payload.mode,
      plan_id: payload.plan_id,
      price_id: priceId,
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
    mode: payload.mode,
    plan_id: payload.plan_id,
    price_id: priceId,
  };
}
