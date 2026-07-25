import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import Stripe from 'npm:stripe@17.7.0';
import { handleCors } from '../_shared/cors.ts';
import { errorResponse } from '../_shared/response.ts';
import { getStripeSecretKey } from '../_shared/stripe.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const stripe = new Stripe(getStripeSecretKey(), {
      apiVersion: '2025-01-27.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const rawBody = await req.text();
    const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    let event: Stripe.Event;

    if (endpointSecret) {
      const signature = req.headers.get('stripe-signature');
      if (!signature) {
        return new Response('Missing stripe-signature header', { status: 400 });
      }
      event = stripe.webhooks.constructEvent(rawBody, signature, endpointSecret);
    } else {
      event = JSON.parse(rawBody) as Stripe.Event;
    }

    let subscription: Stripe.Subscription | undefined;
    let status: string | undefined;

    switch (event.type) {
      case 'customer.subscription.trial_will_end':
      case 'customer.subscription.deleted':
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        subscription = event.data.object as Stripe.Subscription;
        status = subscription.status;
        console.log(`[stripe-test-webhook] ${event.type} → status=${status}`);
        break;
      case 'entitlements.active_entitlement_summary.updated':
        console.log('[stripe-test-webhook] active_entitlement_summary.updated');
        break;
      case 'checkout.session.completed':
        console.log('[stripe-test-webhook] checkout.session.completed');
        break;
      default:
        console.log(`[stripe-test-webhook] unhandled event ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[stripe-test-webhook] error', error);
    return errorResponse(error, req);
  }
});
