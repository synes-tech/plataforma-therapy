import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole, logAuthEvent } from '../_shared/auth.ts';
import { AppError, ValidationError } from '../_shared/errors.ts';
import { ApproveSessionNoteSchema } from './schema.ts';
import { approveSessionNote } from './service.ts';

/**
 * approve-session-note
 *
 * Lapidação + aprovação final do relatório de sessão.
 * Persiste o texto editado pelo terapeuta e controla visibilidade familiar.
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
    logAuthEvent('approve_session_note.attempt', user, 'approve-session-note');

    const body = await req.json();
    const parsed = ApproveSessionNoteSchema.safeParse(body);

    if (!parsed.success) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        statusCode: 400,
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const result = await approveSessionNote(parsed.data, user);
    return successResponse(result, req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
