import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole, logAuthEvent } from '../_shared/auth.ts';
import { AppError, ValidationError } from '../_shared/errors.ts';
import { ProcessSessionTextSchema } from './schema.ts';
import { processSessionText } from './service.ts';

/**
 * process-session-text — Sessão Dual (somente anotações textuais)
 *
 * Gera relatório SOAP draft a partir de anotacoes_texto, sem áudio.
 * Deságua no fluxo existente de aprovação/lapidação.
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
    logAuthEvent('process_session_text.attempt', user, 'process-session-text');

    const body = await req.json();
    const parsed = ProcessSessionTextSchema.safeParse(body);

    if (!parsed.success) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        statusCode: 400,
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const result = await processSessionText(parsed.data, user);
    return successResponse(result, req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
