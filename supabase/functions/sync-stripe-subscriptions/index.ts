import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { syncStripeSubscriptions } from './service.ts';

/**
 * Reconciliação diária Stripe ↔ banco.
 * Autenticação: header X-Cron-Secret (pg_cron ou Postman manual).
 */
serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const result = await syncStripeSubscriptions(req);
    return successResponse(result, req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
