import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole, logAuthEvent } from '../_shared/auth.ts';
import { ValidationError } from '../_shared/errors.ts';
import { RegisterPushSchema } from './schema.ts';
import { registerPushSubscription } from './service.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return errorResponse(new ValidationError({ method: 'Only POST is allowed' }), req);
    }

    const user = await authenticateRequest(req);
    requireRole(user, ['family']);
    logAuthEvent('register_push.attempt', user, 'register-push-subscription');

    const body = await req.json();
    const parsed = RegisterPushSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(new ValidationError(parsed.error.flatten().fieldErrors), req);
    }

    const result = await registerPushSubscription(parsed.data, user);
    return successResponse(result, req, 201);
  } catch (error) {
    return errorResponse(error, req);
  }
});
