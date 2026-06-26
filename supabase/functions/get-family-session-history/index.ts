import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole, logAuthEvent } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import { GetFamilySessionHistorySchema } from './schema.ts';
import { getFamilySessionHistory } from './service.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      throw new AppError({ code: 'METHOD_NOT_ALLOWED', message: 'Only POST is allowed', statusCode: 405 });
    }

    const user = await authenticateRequest(req);
    requireRole(user, ['family']);
    logAuthEvent('family_session_history_viewed', user, 'get-family-session-history');

    const body = await req.json().catch(() => ({}));
    const parsed = GetFamilySessionHistorySchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        statusCode: 400,
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const result = await getFamilySessionHistory(parsed.data, user);
    return successResponse(result, req);
  } catch (error) {
    return errorResponse(error, req);
  }
});
