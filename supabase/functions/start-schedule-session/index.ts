import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole, logAuthEvent } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ValidationError, ForbiddenError } from '../_shared/errors.ts';

/**
 * start-schedule-session
 *
 * Marca o agendamento como em andamento (started_at + status in_progress).
 * Idempotente para sessões já iniciadas.
 */
serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return errorResponse(new ValidationError({ method: 'Only POST is allowed' }), req);
    }

    const user = await authenticateRequest(req);
    requireRole(user, ['professional']);
    logAuthEvent('start_schedule_session.attempt', user, 'start-schedule-session');

    const body = await req.json().catch(() => ({}));
    const scheduleId = String(body.schedule_id ?? '');

    if (!scheduleId) {
      throw new ValidationError({ schedule_id: 'schedule_id é obrigatório.' });
    }

    const supabase = createServiceClient();

    const { data: professional } = await supabase
      .from('professionals')
      .select('id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (!professional) {
      throw new AppError({ code: 'NO_ACCESS', message: 'Profissional não encontrado', statusCode: 403 });
    }

    const { data: schedule, error: fetchError } = await supabase
      .from('therapist_schedule')
      .select('id, patient_id, status, started_at, scheduled_at')
      .eq('id', scheduleId)
      .eq('professional_id', professional.id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !schedule) {
      throw new ForbiddenError('Agendamento não encontrado ou sem permissão.');
    }

    if (!schedule.patient_id) {
      throw new AppError({
        code: 'NO_PATIENT',
        message: 'Este agendamento não possui paciente vinculado.',
        statusCode: 400,
      });
    }

    if (schedule.status === 'completed') {
      throw new AppError({
        code: 'ALREADY_COMPLETED',
        message: 'Esta sessão já foi concluída.',
        statusCode: 409,
      });
    }

    if (schedule.status === 'cancelled' || schedule.status === 'no_show') {
      throw new AppError({
        code: 'INVALID_STATUS',
        message: 'Não é possível iniciar um agendamento cancelado ou marcado como falta.',
        statusCode: 400,
      });
    }

    const now = new Date().toISOString();
    const needsUpdate = schedule.status !== 'in_progress' || !schedule.started_at;

    if (needsUpdate) {
      const { error: updateError } = await supabase
        .from('therapist_schedule')
        .update({
          status: 'in_progress',
          started_at: schedule.started_at ?? now,
        })
        .eq('id', scheduleId);

      if (updateError) {
        throw new AppError({ code: 'UPDATE_FAILED', message: updateError.message, statusCode: 500 });
      }
    }

    logAuthEvent('start_schedule_session.success', user, 'start-schedule-session', {
      schedule_id: scheduleId,
      patient_id: schedule.patient_id,
    });

    return successResponse(
      {
        schedule_id: schedule.id,
        patient_id: schedule.patient_id,
        status: 'in_progress',
        started_at: schedule.started_at ?? now,
      },
      req,
      200,
    );
  } catch (error) {
    return errorResponse(error, req);
  }
});
