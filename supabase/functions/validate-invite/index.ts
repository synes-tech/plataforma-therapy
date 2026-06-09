import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, logAuthEvent } from '../_shared/auth.ts';
import { ValidationError } from '../_shared/errors.ts';
import { ValidateInviteSchema } from './schema.ts';
import { validateInvite } from './service.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return errorResponse(new ValidationError({ method: 'Only POST is allowed' }), req);
    }

    // Any authenticated user can validate an invite (they just signed up)
    const user = await authenticateRequest(req);
    logAuthEvent('validate_invite.attempt', user, 'validate-invite');

    const body = await req.json();
    const parseResult = ValidateInviteSchema.safeParse(body);

    if (!parseResult.success) {
      return errorResponse(new ValidationError(parseResult.error.flatten().fieldErrors), req);
    }

    const result = await validateInvite(parseResult.data, user);

    return successResponse(result, req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
