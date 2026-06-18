import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';

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
      .select('id, clinic_id')
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

    return successResponse(created, req, 201);
  } catch (error) {
    return errorResponse(error, req);
  }
});
