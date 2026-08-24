import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole, logAuthEvent } from '../_shared/auth.ts';
import { ValidationError } from '../_shared/errors.ts';
import { assertAiRateLimit } from '../_shared/rate-limit.ts';
import { QueryPatientCompanionSchema } from './schema.ts';
import { queryPatientCompanion, queryPatientCompanionStream, streamResponse } from './service.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return errorResponse(new ValidationError({ method: 'Only POST is allowed' }), req);
    }

    const user = await authenticateRequest(req);
    requireRole(user, ['family']);
    await assertAiRateLimit(user, 'companion');
    logAuthEvent('companion_query.attempt', user, 'query-patient-companion');

    const body = await req.json();
    const parsed = QueryPatientCompanionSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(new ValidationError(parsed.error.flatten().fieldErrors), req);
    }

    if (parsed.data.stream) {
      return streamResponse(queryPatientCompanionStream(parsed.data, user), req);
    }

    const response = await queryPatientCompanion(parsed.data, user);
    return successResponse(response, req);
  } catch (error) {
    return errorResponse(error, req);
  }
});
