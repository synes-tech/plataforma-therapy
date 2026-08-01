import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import { notifySessionScheduled } from '../_shared/session-email-jobs.ts';

/**
 * create-schedule
 *
 * Cria um novo agendamento na agenda do terapeuta.
 * Valida que o paciente pertence ao profissional autenticado.
 *
 * TODO (Agente IA — Vertex AI): No futuro, pode-se chamar o LLM aqui
 * para sugerir `duration_minutes` com base no histórico do paciente
 * (ex: pacientes com muitas crises → sessões mais longas).
 */

const createScheduleSchema = z.object({
  patient_id: z.string().uuid(),
  scheduled_at: z.string().datetime({ message: 'scheduled_at deve ser ISO 8601' }),
  duration_minutes: z.number().int().min(10).max(180).default(50),
  title: z.string().min(1).max(200).optional(),
  notes: z.string().max(1000).optional(),
});

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const user = await authenticateRequest(req);
    requireRole(user, ['professional']);

    const body = await req.json();
    const parsed = createScheduleSchema.safeParse(body);

    if (!parsed.success) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        statusCode: 400,
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { patient_id, scheduled_at, duration_minutes, title, notes } = parsed.data;
    const supabase = createServiceClient();

    // Get professional record
    const { data: professional } = await supabase
      .from('professionals')
      .select('id, clinic_id, name')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (!professional) {
      throw new AppError({ code: 'NO_ACCESS', message: 'Profissional não encontrado', statusCode: 403 });
    }

    // Validate patient belongs to this professional
    const { data: patient } = await supabase
      .from('patients')
      .select('id, name')
      .eq('id', patient_id)
      .eq('professional_id', professional.id)
      .is('deleted_at', null)
      .single();

    if (!patient) {
      throw new AppError({ code: 'PATIENT_NOT_FOUND', message: 'Paciente não encontrado ou não pertence a você', statusCode: 404 });
    }

    // Block scheduling in the past
    if (new Date(scheduled_at).getTime() < Date.now() - 60_000) {
      throw new AppError({ code: 'PAST_DATE', message: 'Não é possível agendar no passado', statusCode: 400 });
    }

    // Cota de sessões do plano (v2):
    // - limite hard: total mensal do plano (pacientes efetivos × 4)
    // - limite soft: 4 sessões por paciente/mês (aviso detalhado, sem bloquear)
    const { data: quota } = await supabase.rpc('check_session_quota', {
      p_clinic_id: professional.clinic_id,
      p_patient_id: patient_id,
    });

    const quotaState = (quota ?? null) as {
      unlimited?: boolean;
      total_used?: number;
      total_limit?: number;
      patient_used?: number;
      patient_recommended?: number;
      warn_patient?: boolean;
      blocked_total?: boolean;
      error?: string;
    } | null;

    if (quotaState && !quotaState.error && !quotaState.unlimited && quotaState.blocked_total) {
      throw new AppError({
        code: 'SESSION_QUOTA_EXCEEDED',
        message: `Você atingiu o limite de ${quotaState.total_limit} sessões deste mês no seu plano. Faça upgrade ou contrate um Módulo Adicional para continuar agendando.`,
        statusCode: 402,
        details: {
          total_used: quotaState.total_used,
          total_limit: quotaState.total_limit,
        },
      });
    }

    // Duração máxima da sessão conforme o plano (FREE 50 min, pagos 60 min)
    const { data: clinicPlan } = await supabase
      .from('clinics')
      .select('subscription_plan, billing_exempt')
      .eq('id', professional.clinic_id)
      .single();

    const billingExempt = clinicPlan?.billing_exempt === true;
    if (!billingExempt) {
      const { data: planoRow } = await supabase
        .from('planos')
        .select('duracao_sessao_minutos, nome')
        .eq('id', clinicPlan?.subscription_plan ?? '')
        .maybeSingle();

      const maxDuration = Number(planoRow?.duracao_sessao_minutos ?? 60);
      if (duration_minutes > maxDuration) {
        throw new AppError({
          code: 'SESSION_DURATION_LIMIT',
          message: `Seu plano ${planoRow?.nome ?? ''} permite sessões de até ${maxDuration} minutos.`,
          statusCode: 400,
          details: { max_duration_minutes: maxDuration },
        });
      }
    }

    // Create the schedule entry
    const { data: created, error } = await supabase
      .from('therapist_schedule')
      .insert({
        professional_id: professional.id,
        patient_id,
        clinic_id: professional.clinic_id,
        title: title ?? `Sessão — ${patient.name}`,
        scheduled_at,
        duration_minutes,
        notes: notes ?? null,
        status: 'scheduled',
      })
      .select('id, patient_id, title, scheduled_at, duration_minutes, status')
      .single();

    if (error) {
      throw new AppError({ code: 'CREATE_FAILED', message: error.message, statusCode: 500 });
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      clinic_id: professional.clinic_id,
      action: 'session.created',
      resource_type: 'therapist_schedule',
      resource_id: created.id,
      metadata: { patient_id, scheduled_at, duration_minutes },
    });

    // Confirmação por e-mail + enfileira lembrete 24h (best-effort; não bloqueia o agendamento)
    let emailNotify: { confirmation_sent: number; reminder_24h_queued: number } | null = null;
    try {
      emailNotify = await notifySessionScheduled({
        supabase,
        scheduleId: created.id,
        patientId: patient_id,
        clinicId: professional.clinic_id,
        professionalId: professional.id,
        professionalName: (professional.name as string) || 'terapeuta',
        scheduledAtIso: scheduled_at,
        durationMinutes: duration_minutes,
      });
    } catch (emailErr) {
      console.error('[create-schedule] session email notify failed', emailErr);
    }

    // Aviso soft: recomendação de 4 sessões/paciente/mês excedida
    const quotaWarning =
      quotaState && !quotaState.error && quotaState.warn_patient
        ? {
            code: 'PATIENT_SESSION_RECOMMENDATION_EXCEEDED',
            patient_used: (quotaState.patient_used ?? 0) + 1,
            patient_recommended: quotaState.patient_recommended ?? 4,
            total_used: (quotaState.total_used ?? 0) + 1,
            total_limit: quotaState.total_limit ?? null,
            message: `O limite recomendado de sessões para este paciente (${quotaState.patient_recommended ?? 4}/mês) já foi atingido. Se realizar mais sessões com ele, poderá faltar para outros pacientes — seu limite total é de ${quotaState.total_limit} sessões/mês (usadas: ${(quotaState.total_used ?? 0) + 1}).`,
          }
        : null;

    return successResponse(
      { ...created, quota_warning: quotaWarning, email_notify: emailNotify },
      req,
      201,
    );
  } catch (error) {
    return errorResponse(error, req);
  }
});
