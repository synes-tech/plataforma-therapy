import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole, logAuthEvent } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import { getPortalContext } from './service.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST' && req.method !== 'GET') {
      throw new AppError({ code: 'METHOD_NOT_ALLOWED', message: 'Only GET or POST', statusCode: 405 });
    }

    const user = await authenticateRequest(req);
    requireRole(user, ['family']);
    logAuthEvent('portal_context_read', user, 'get-portal-context');

    const result = await getPortalContext(user);
    return successResponse(result, req);
  } catch (error) {
    return errorResponse(error, req);
  }
});
