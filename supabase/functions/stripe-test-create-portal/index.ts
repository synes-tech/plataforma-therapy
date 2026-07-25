import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { ValidationError } from '../_shared/errors.ts';
import { StripeTestCreatePortalSchema } from './schema.ts';
import { stripeTestCreatePortal } from './service.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return errorResponse(new ValidationError({ method: 'Only POST is allowed' }), req);
    }

    const body = await req.json();
    const parsed = StripeTestCreatePortalSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(new ValidationError(parsed.error.flatten().fieldErrors), req);
    }

    const result = await stripeTestCreatePortal(parsed.data, req);
    return successResponse(result, req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
