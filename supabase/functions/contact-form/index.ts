import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { ValidationError } from '../_shared/errors.ts';
import { assertIpRateLimit } from '../_shared/rate-limit.ts';
import { ContactFormSchema } from './schema.ts';
import { submitContactForm } from './service.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return errorResponse(new ValidationError({ method: 'Only POST is allowed' }), req);
    }

    await assertIpRateLimit(req, { bucket: 'contact_form', limit: 5, windowSec: 15 * 60 });

    const body = await req.json().catch(() => ({}));
    const parsed = ContactFormSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(new ValidationError(parsed.error.flatten().fieldErrors), req);
    }

    const result = await submitContactForm(parsed.data);
    return successResponse(result, req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
