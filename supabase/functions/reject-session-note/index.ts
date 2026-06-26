import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole, logAuthEvent } from '../_shared/auth.ts';
import { AppError, ValidationError } from '../_shared/errors.ts';
import { RejectSessionNoteSchema } from './schema.ts';
import { rejectSessionNote } from './service.ts';

/**
 * reject-session-note
 *
 * Reprova e remove (soft delete) um relatório de sessão ainda em rascunho.
 * Disponível na fila de revisão antes da aprovação final.
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
    logAuthEvent('reject_session_note.attempt', user, 'reject-session-note');

    const body = await req.json();
    const parsed = RejectSessionNoteSchema.safeParse(body);

    if (!parsed.success) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        statusCode: 400,
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const result = await rejectSessionNote(parsed.data, user);
    return successResponse(result, req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
