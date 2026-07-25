import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { assertStripeTestPageEnabled } from '../_shared/stripe.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    assertStripeTestPageEnabled();

    return successResponse(
      {
        test_publishable_key: Deno.env.get('STRIPE_TEST_PUBLISHABLE_KEY') ?? null,
        live_publishable_key: Deno.env.get('STRIPE_LIVE_PUBLISHABLE_KEY') ?? null,
        live_checkout_enabled: Deno.env.get('STRIPE_LIVE_CHECKOUT_ENABLED') === 'true',
      },
      req,
      200,
    );
  } catch (error) {
    return errorResponse(error, req);
  }
});
