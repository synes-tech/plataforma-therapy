import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole, logAuthEvent } from '../_shared/auth.ts';
import { ValidationError } from '../_shared/errors.ts';
import { QueryCopilotSchema } from './schema.ts';
import { queryCopilot } from './service.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return errorResponse(new ValidationError({ method: 'Only POST is allowed' }), req);
    }

    // Only professionals can use the copilot
    const user = await authenticateRequest(req);
    requireRole(user, ['professional']);
    logAuthEvent('copilot_query.attempt', user, 'query-copilot');

    const body = await req.json();
    const parseResult = QueryCopilotSchema.safeParse(body);

    if (!parseResult.success) {
      return errorResponse(new ValidationError(parseResult.error.flatten().fieldErrors), req);
    }

    const result = await queryCopilot(parseResult.data, user);

    return successResponse(result, req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
