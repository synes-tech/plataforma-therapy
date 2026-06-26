import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole, logAuthEvent } from '../_shared/auth.ts';
import { AppError, ValidationError } from '../_shared/errors.ts';
import { SaveSessionAnnotationsSchema } from './schema.ts';
import { saveSessionAnnotations } from './service.ts';

/**
 * save-session-annotations — persiste anotações ao vivo durante gravação (modo dual).
 */
serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return errorResponse(new ValidationError({ method: 'Only POST is allowed' }), req);
    }

    const user = await authenticateRequest(req);
    requireRole(user, ['professional', 'master']);
    logAuthEvent('save_session_annotations.attempt', user, 'save-session-annotations');

    const body = await req.json();
    const parsed = SaveSessionAnnotationsSchema.safeParse(body);

    if (!parsed.success) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        statusCode: 400,
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const result = await saveSessionAnnotations(parsed.data, user);
    return successResponse(result, req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
