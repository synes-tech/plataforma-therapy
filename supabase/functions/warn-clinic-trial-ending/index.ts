import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { ValidationError } from '../_shared/errors.ts';
import { assertCronAuth } from '../_shared/cron-auth.ts';
import { warnClinicTrialEnding } from './service.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return errorResponse(new ValidationError({ method: 'Only POST is allowed' }), req);
    }

    assertCronAuth(req);
    const result = await warnClinicTrialEnding();
    return successResponse(result, req);
  } catch (error) {
    return errorResponse(error, req);
  }
});
