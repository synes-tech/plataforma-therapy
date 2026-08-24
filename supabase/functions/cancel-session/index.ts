import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole, logAuthEvent } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ValidationError, ForbiddenError } from '../_shared/errors.ts';
import {
  cancelPendingAutoReminders,
  notifySessionCancelled,
} from '../_shared/session-email-jobs.ts';

/**
 * cancel-session
 *
 * Cancela uma sessão do terapeuta autenticado (isolamento por professional_id).
 * Remove da agenda do dia, cancela lembretes pendentes, marca cobrança aberta
 * como CANCELADO e envia e-mail SES para paciente/responsável e psicólogo.
 */

const BLOCKED_STATUSES = new Set(['cancelled', 'canceled', 'completed']);

const BILLING_OPEN_STATUSES = [
  'AGUARDANDO_SESSAO',
  'PENDENTE_CONFIRMACAO',
  'INCLUIDO_MENSALIDADE',
  'REMARCADO',
];

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

    if (!sessionId) {
      throw new ValidationError({ session_id: 'session_id é obrigatório.' });
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
      .select('id, professional_id, clinic_id, patient_id, scheduled_at, duration_minutes, status')
      .eq('id', sessionId)
      .is('deleted_at', null)
      .single();

    if (!session) {
      throw new AppError({ code: 'NOT_FOUND', message: 'Sessão não encontrada', statusCode: 404 });
    }
    if (session.professional_id !== professional.id) {
      throw new ForbiddenError('Você não tem acesso a esta sessão.');
    }

    const currentStatus = String(session.status ?? '');
    if (BLOCKED_STATUSES.has(currentStatus)) {
      throw new AppError({
        code: currentStatus === 'completed' ? 'CANNOT_CANCEL_COMPLETED' : 'ALREADY_CANCELLED',
        message:
          currentStatus === 'completed'
            ? 'Não é possível cancelar um atendimento já concluído.'
            : 'Este atendimento já está cancelado.',
        statusCode: 400,
      });
    }

    const { data: updated, error: updErr } = await supabase
      .from('therapist_schedule')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', sessionId)
      .select('id, scheduled_at, status, duration_minutes')
      .single();

    if (updErr) {
      throw new AppError({ code: 'UPDATE_FAILED', message: updErr.message, statusCode: 500 });
    }

    await cancelPendingAutoReminders(supabase, sessionId, ['reminder_24h', 'reminder_manual']);

    await supabase
      .from('financeiro_sessoes_cobranca')
      .update({ status_cobranca: 'CANCELADO', updated_at: new Date().toISOString() })
      .eq('schedule_id', sessionId)
      .in('status_cobranca', BILLING_OPEN_STATUSES)
      .is('deleted_at', null);

    logAuthEvent('session.cancelled', user, 'cancel-session');
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      clinic_id: session.clinic_id,
      action: 'session.cancelled',
      resource_type: 'therapist_schedule',
      resource_id: sessionId,
      metadata: {
        previous_status: currentStatus,
        scheduled_at: session.scheduled_at,
        patient_id: session.patient_id,
      },
    });

    let emailNotify: { contact_sent: number; professional_sent: number } | null = null;

    if (session.patient_id) {
      try {
        emailNotify = await notifySessionCancelled({
          supabase,
          scheduleId: sessionId,
          patientId: session.patient_id as string,
          clinicId: session.clinic_id as string,
          professionalId: professional.id as string,
          professionalName: (professional.name as string) || 'terapeuta',
          professionalEmail: (professional.email as string) || user.email || null,
          scheduledAtIso: session.scheduled_at as string,
          durationMinutes: session.duration_minutes ? Number(session.duration_minutes) : null,
        });
      } catch (emailErr) {
        console.error('[cancel-session] email notify failed', emailErr);
      }
    }

    return successResponse({ ...updated, email_notify: emailNotify }, req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
