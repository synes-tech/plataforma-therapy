import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { errorResponse } from '../_shared/response.ts';
import { handleStripeBillingWebhook } from './service.ts';

/**
 * Webhook de produção — provisiona assinaturas da plataforma.
 * URL: /functions/v1/stripe-webhook
 * Eventos: checkout.session.completed, customer.subscription.*, invoice.payment_failed
 */
serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    return await handleStripeBillingWebhook(req);
  } catch (error) {
    return errorResponse(error, req);
  }
});
