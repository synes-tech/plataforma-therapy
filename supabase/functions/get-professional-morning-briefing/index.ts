import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';

/**
 * get-professional-morning-briefing
 *
 * Agrega, em uma única chamada, o "Resumo Matinal" do terapeuta:
 *  - Agenda do dia (therapist_schedule do profissional, hoje, fuso BR).
 *  - Alertas da família (diary_entries dos pacientes vinculados nas últimas 24h).
 *
 * Isolamento: a função usa service_role mas filtra estritamente pelos pacientes
 * cujo professional_id pertence ao usuário autenticado (espelha o RLS).
 */

const BR_TZ = 'America/Sao_Paulo';

function brToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

interface SchedulePatient {
  id: string;
  name: string;
  birth_date: string | null;
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const user = await authenticateRequest(req);
    requireRole(user, ['professional']);

    const supabase = createServiceClient();

    // 1. Resolver o registro do profissional a partir do usuário autenticado
    const { data: professional } = await supabase
      .from('professionals')
      .select('id, name, clinic_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (!professional) {
      throw new AppError({ code: 'NO_ACCESS', message: 'Profissional não encontrado', statusCode: 403 });
    }

    // 2. Pacientes vinculados ao profissional (base do isolamento)
    const { data: patientsData } = await supabase
      .from('patients')
      .select('id, name, birth_date')
      .eq('professional_id', professional.id)
      .is('deleted_at', null);

    const patients = (patientsData ?? []) as SchedulePatient[];
    const patientMap = new Map(patients.map((p) => [p.id, p]));
    const patientIds = patients.map((p) => p.id);

    // 3. Agenda do dia (fuso BR)
    const day = brToday();
    const dayStart = `${day}T00:00:00-03:00`;
    const dayEnd = `${day}T23:59:59-03:00`;

    const { data: scheduleData, error: scheduleError } = await supabase
      .from('therapist_schedule')
      .select('id, patient_id, title, scheduled_at, duration_minutes, status, notes')
      .eq('professional_id', professional.id)
      .is('deleted_at', null)
      .gte('scheduled_at', dayStart)
      .lte('scheduled_at', dayEnd)
      .order('scheduled_at', { ascending: true });

    if (scheduleError) {
      throw new AppError({ code: 'SCHEDULE_FETCH_FAILED', message: scheduleError.message, statusCode: 500 });
    }

    const schedule = (scheduleData ?? []).map((s) => {
      const patient = s.patient_id ? patientMap.get(s.patient_id) ?? null : null;
      return {
        id: s.id,
        title: s.title,
        scheduled_at: s.scheduled_at,
        duration_minutes: s.duration_minutes,
        status: s.status,
        patient: patient
          ? { id: patient.id, name: patient.name, birth_date: patient.birth_date }
          : null,
      };
    });

    // 4. Alertas da família — diary_entries das últimas 24h dos pacientes vinculados
    let alerts: Array<Record<string, unknown>> = [];
    if (patientIds.length > 0) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data: diaryData, error: diaryError } = await supabase
        .from('diary_entries')
        .select('id, patient_id, entry_date, mood_score, sleep_quality, crisis_occurred, crisis_level, notes, created_at')
        .in('patient_id', patientIds)
        .is('deleted_at', null)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(20);

      if (diaryError) {
        throw new AppError({ code: 'DIARY_FETCH_FAILED', message: diaryError.message, statusCode: 500 });
      }

      alerts = (diaryData ?? []).map((d) => {
        const patient = patientMap.get(d.patient_id) ?? null;
        const hoursAgo = Math.max(
          0,
          Math.round((Date.now() - new Date(d.created_at as string).getTime()) / (60 * 60 * 1000)),
        );
        return {
          id: d.id,
          type: d.crisis_occurred ? 'crisis' : 'positive',
          patient: patient ? { id: patient.id, name: patient.name } : null,
          entry_date: d.entry_date,
          mood_score: d.mood_score,
          sleep_quality: d.sleep_quality,
          crisis_occurred: d.crisis_occurred,
          crisis_level: d.crisis_level,
          notes: d.notes,
          created_at: d.created_at,
          hours_ago: hoursAgo,
        };
      });
    }

    return successResponse(
      {
        professional: { id: professional.id, name: professional.name },
        date: day,
        schedule,
        alerts,
        summary: {
          sessions_today: schedule.length,
          alerts_count: alerts.length,
          crisis_count: alerts.filter((a) => a.type === 'crisis').length,
        },
      },
      req,
      200,
    );
  } catch (error) {
    return errorResponse(error, req);
  }
});
