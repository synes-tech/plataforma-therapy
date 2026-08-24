import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole, logAuthEvent } from '../_shared/auth.ts';
import { ValidationError } from '../_shared/errors.ts';
import { CreatePatientCheckoutSchema } from './schema.ts';
import { createPatientCheckout } from './service.ts';

/**
 * POST /functions/v1/create-patient-checkout
 * Alias Cloud Run: POST /api/billing/patient-checkout
 *
 * Checkout Stripe da Ivy (B2C). Só adulto SELF sem assinatura ativa.
 */
serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return errorResponse(new ValidationError({ method: 'Only POST is allowed' }), req);
    }

    const user = await authenticateRequest(req);
    requireRole(user, ['family']);
    logAuthEvent('patient_checkout.attempt', user, 'create-patient-checkout');

    const body = await req.json().catch(() => ({}));
    const parsed = CreatePatientCheckoutSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(new ValidationError(parsed.error.flatten().fieldErrors), req);
    }

    const result = await createPatientCheckout(parsed.data, user, req);
    return successResponse(result, req);
  } catch (error) {
    return errorResponse(error, req);
  }
});
