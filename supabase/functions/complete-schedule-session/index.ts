import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole, logAuthEvent } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ValidationError, ForbiddenError } from '../_shared/errors.ts';

/**
 * complete-schedule-session
 *
 * Marca o agendamento como concluído após aprovação do relatório (session_note approved).
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
    logAuthEvent('complete_schedule_session.attempt', user, 'complete-schedule-session');

    const body = await req.json().catch(() => ({}));
    const scheduleId = String(body.schedule_id ?? '');
    const sessionNoteId = String(body.session_note_id ?? '');

    if (!scheduleId || !sessionNoteId) {
      throw new ValidationError({
        schedule_id: 'schedule_id e session_note_id são obrigatórios.',
      });
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

    const { data: schedule, error: scheduleError } = await supabase
      .from('therapist_schedule')
      .select('id, patient_id, status, professional_id')
      .eq('id', scheduleId)
      .eq('professional_id', professional.id)
      .is('deleted_at', null)
      .single();

    if (scheduleError || !schedule) {
      throw new ForbiddenError('Agendamento não encontrado ou sem permissão.');
    }

    const { data: note, error: noteError } = await supabase
      .from('session_notes')
      .select('id, patient_id, professional_id, status, schedule_id')
      .eq('id', sessionNoteId)
      .eq('professional_id', professional.id)
      .is('deleted_at', null)
      .single();

    if (noteError || !note) {
      throw new ForbiddenError('Relatório não encontrado ou sem permissão.');
    }

    if (note.patient_id !== schedule.patient_id) {
      throw new AppError({
        code: 'PATIENT_MISMATCH',
        message: 'O relatório não pertence ao paciente deste agendamento.',
        statusCode: 400,
      });
    }

    if (note.status !== 'approved') {
      throw new AppError({
        code: 'NOTE_NOT_APPROVED',
        message: 'O relatório precisa estar aprovado antes de concluir a sessão.',
        statusCode: 400,
      });
    }

    const now = new Date().toISOString();

    if (note.schedule_id !== scheduleId) {
      await supabase
        .from('session_notes')
        .update({ schedule_id: scheduleId })
        .eq('id', sessionNoteId);
    }

    const { error: updateError } = await supabase
      .from('therapist_schedule')
      .update({
        status: 'completed',
        completed_at: now,
        session_note_id: sessionNoteId,
      })
      .eq('id', scheduleId);

    if (updateError) {
      throw new AppError({ code: 'UPDATE_FAILED', message: updateError.message, statusCode: 500 });
    }

    logAuthEvent('complete_schedule_session.success', user, 'complete-schedule-session', {
      schedule_id: scheduleId,
      session_note_id: sessionNoteId,
    });

    return successResponse(
      {
        schedule_id: scheduleId,
        session_note_id: sessionNoteId,
        status: 'completed',
        completed_at: now,
      },
      req,
      200,
    );
  } catch (error) {
    return errorResponse(error, req);
  }
});
