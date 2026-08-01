import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import { assertFinanceAccess } from '../_shared/financeiro.ts';

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  try {
    const user = await authenticateRequest(req);
    const clinicId = assertFinanceAccess(user);
    const body = await req.json();
    const scheduleId = String(body.schedule_id ?? '');
    const newStart = String(body.new_start ?? '');
    const parsed = new Date(newStart);
    if (!scheduleId || Number.isNaN(parsed.getTime())) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'schedule_id e new_start (ISO) são obrigatórios',
        statusCode: 400,
      });
    }
    if (parsed.getTime() < Date.now() - 60_000) {
      throw new AppError({ code: 'PAST_DATE', message: 'Não é possível remarcar no passado', statusCode: 400 });
    }

    const supabase = createServiceClient();
    const { data: session } = await supabase
      .from('therapist_schedule')
      .select('id, clinic_id')
      .eq('id', scheduleId)
      .eq('clinic_id', clinicId)
      .is('deleted_at', null)
      .maybeSingle();
    if (!session) {
      throw new AppError({ code: 'NOT_FOUND', message: 'Sessão não encontrada', statusCode: 404 });
    }

    const { data: updated, error } = await supabase
      .from('therapist_schedule')
      .update({ scheduled_at: parsed.toISOString(), status: 'scheduled' })
      .eq('id', scheduleId)
      .select('id, scheduled_at, status')
      .single();
    if (error) throw new AppError({ code: 'UPDATE_FAILED', message: error.message, statusCode: 500 });

    await supabase
      .from('financeiro_sessoes_cobranca')
      .update({ status_cobranca: 'REMARCADO', updated_at: new Date().toISOString() })
      .eq('schedule_id', scheduleId)
      .eq('clinic_id', clinicId);

    // Nova linha aguardando a nova data
    await supabase.from('financeiro_sessoes_cobranca').upsert(
      {
        clinic_id: clinicId,
        schedule_id: scheduleId,
        patient_id: (
          await supabase.from('therapist_schedule').select('patient_id').eq('id', scheduleId).single()
        ).data?.patient_id,
        status_cobranca: 'AGUARDANDO_SESSAO',
        valor_previsto_cents: 0,
        deleted_at: null,
      },
      { onConflict: 'schedule_id' },
    );

    return successResponse({ item: updated }, req);
  } catch (error) {
    return errorResponse(error, req);
  }
});
