import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole, logAuthEvent } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import { ScheduledTherapiesSchema } from './schema.ts';
import { getPatientScheduledTherapies } from './service.ts';

/**
 * get-patient-scheduled-therapies
 *
 * Calendário leve de sessões agendadas/confirmadas para o portal da família.
 * Não inclui check-ins diários — rota isolada do diário de rotina.
 */
serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      throw new AppError({ code: 'METHOD_NOT_ALLOWED', message: 'Only POST is allowed', statusCode: 405 });
    }

    const user = await authenticateRequest(req);
    requireRole(user, ['family']);
    logAuthEvent('scheduled_therapies_viewed', user, 'get-patient-scheduled-therapies');

    const body = await req.json();
    const parsed = ScheduledTherapiesSchema.safeParse(body);

    if (!parsed.success) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        statusCode: 400,
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const result = await getPatientScheduledTherapies(parsed.data, user);
    return successResponse(result, req);
  } catch (error) {
    return errorResponse(error, req);
  }
});
