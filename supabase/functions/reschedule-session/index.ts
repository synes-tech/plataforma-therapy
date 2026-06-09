import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole, logAuthEvent } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ValidationError, ForbiddenError } from '../_shared/errors.ts';

/**
 * reschedule-session
 *
 * Remarca uma sessão (altera scheduled_at). Valida que a sessão pertence ao
 * terapeuta autenticado (isolamento). Bloqueia remarcar para o passado.
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

    // Bloqueio suave: não remarcar para antes de agora
    if (parsed.getTime() < Date.now() - 60_000) {
      throw new AppError({ code: 'PAST_DATE', message: 'Não é possível remarcar para uma data/hora no passado.', statusCode: 400 });
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

    // Verifica posse da sessão
    const { data: session } = await supabase
      .from('therapist_schedule')
      .select('id, professional_id, clinic_id, patient_id')
      .eq('id', sessionId)
      .is('deleted_at', null)
      .single();

    if (!session) {
      throw new AppError({ code: 'NOT_FOUND', message: 'Sessão não encontrada', statusCode: 404 });
    }
    if (session.professional_id !== professional.id) {
      throw new ForbiddenError('Você não tem acesso a esta sessão.');
    }

    const { data: updated, error: updErr } = await supabase
      .from('therapist_schedule')
      .update({ scheduled_at: parsed.toISOString(), updated_at: new Date().toISOString() })
      .eq('id', sessionId)
      .select('id, scheduled_at, status')
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
      metadata: { new_start: parsed.toISOString(), patient_id: session.patient_id },
    });

    return successResponse(updated, req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
