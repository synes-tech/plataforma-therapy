import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole, logAuthEvent } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import { PatientCrisisCalendarSchema } from './schema.ts';
import { getPatientCrisisCalendar } from './service.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      throw new AppError({ code: 'METHOD_NOT_ALLOWED', message: 'Only POST is allowed', statusCode: 405 });
    }

    const user = await authenticateRequest(req);
    requireRole(user, ['professional', 'clinic_admin', 'master']);

    const body = await req.json();
    const parsed = PatientCrisisCalendarSchema.safeParse(body);

    if (!parsed.success) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        statusCode: 400,
        details: parsed.error.flatten().fieldErrors,
      });
    }

    logAuthEvent('crisis_calendar_viewed', user, 'get-patient-crisis-calendar', {
      patient_id: parsed.data.patient_id,
      year: parsed.data.year,
      month: parsed.data.month,
    });

    const result = await getPatientCrisisCalendar(parsed.data, user);
    return successResponse(result, req);
  } catch (error) {
    return errorResponse(error, req);
  }
});
