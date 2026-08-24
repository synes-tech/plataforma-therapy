import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole, logAuthEvent } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ValidationError, ForbiddenError } from '../_shared/errors.ts';
import {
  notifySessionRescheduled,
  requeueReminder24hAfterReschedule,
} from '../_shared/session-email-jobs.ts';

/**
 * reschedule-session
 *
 * Remarca uma sessão (altera scheduled_at). Valida que a sessão pertence ao
 * terapeuta autenticado (isolamento). Bloqueia remarcar para o passado.
 * Envia e-mail de reagendamento para contatos do paciente e para o profissional.
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

    const body = await req.json().catch(() => ({}));
    const sessionId = String(body.session_id ?? '');
    const newStart = String(body.new_start ?? '');
    const parsed = new Date(newStart);

    if (!sessionId || Number.isNaN(parsed.getTime())) {
      throw new ValidationError({ session_id: 'session_id e new_start (ISO) são obrigatórios.' });
    }

    if (parsed.getTime() < Date.now() - 60_000) {
      throw new AppError({
        code: 'PAST_DATE',
        message: 'Não é possível remarcar para uma data/hora no passado.',
        statusCode: 400,
      });
    }

    const supabase = createServiceClient();

    const { data: professional } = await supabase
      .from('professionals')
      .select('id, name, email')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (!professional) {
      throw new AppError({ code: 'NO_ACCESS', message: 'Profissional não encontrado', statusCode: 403 });
    }

    const { data: session } = await supabase
      .from('therapist_schedule')
      .select('id, professional_id, clinic_id, patient_id, scheduled_at, duration_minutes')
      .eq('id', sessionId)
      .is('deleted_at', null)
      .single();

    if (!session) {
      throw new AppError({ code: 'NOT_FOUND', message: 'Sessão não encontrada', statusCode: 404 });
    }
    if (session.professional_id !== professional.id) {
      throw new ForbiddenError('Você não tem acesso a esta sessão.');
    }

    const previousScheduledAt = session.scheduled_at as string;

    const { data: updated, error: updErr } = await supabase
      .from('therapist_schedule')
      .update({ scheduled_at: parsed.toISOString(), updated_at: new Date().toISOString() })
      .eq('id', sessionId)
      .select('id, scheduled_at, status, duration_minutes')
      .single();

    if (updErr) {
      throw new AppError({ code: 'UPDATE_FAILED', message: updErr.message, statusCode: 500 });
    }

    logAuthEvent('session.rescheduled', user, 'reschedule-session');
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      clinic_id: session.clinic_id,
      action: 'session.rescheduled',
      resource_type: 'therapist_schedule',
      resource_id: sessionId,
      metadata: {
        previous_start: previousScheduledAt,
        new_start: parsed.toISOString(),
        patient_id: session.patient_id,
      },
    });

    let emailNotify: { contact_sent: number; professional_sent: number; reminder_24h_queued: number } | null =
      null;

    if (session.patient_id) {
      try {
        const notify = await notifySessionRescheduled({
          supabase,
          scheduleId: sessionId,
          patientId: session.patient_id as string,
          clinicId: session.clinic_id as string,
          professionalId: professional.id as string,
          professionalName: (professional.name as string) || 'terapeuta',
          professionalEmail: (professional.email as string) || user.email || null,
          previousScheduledAtIso: previousScheduledAt,
          scheduledAtIso: parsed.toISOString(),
          durationMinutes: session.duration_minutes ? Number(session.duration_minutes) : null,
        });

        const reminderQueued = await requeueReminder24hAfterReschedule({
          supabase,
          scheduleId: sessionId,
          patientId: session.patient_id as string,
          clinicId: session.clinic_id as string,
          professionalId: professional.id as string,
          professionalName: (professional.name as string) || 'terapeuta',
          professionalEmail: (professional.email as string) || user.email || null,
          scheduledAtIso: parsed.toISOString(),
        });

        emailNotify = {
          contact_sent: notify.contact_sent,
          professional_sent: notify.professional_sent,
          reminder_24h_queued: reminderQueued,
        };
      } catch (emailErr) {
        console.error('[reschedule-session] email notify failed', emailErr);
      }
    }

    return successResponse({ ...updated, email_notify: emailNotify }, req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
