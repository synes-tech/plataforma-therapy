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

function brWeekday(date = new Date()): number {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: BR_TZ, weekday: 'short' }).format(date);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd.slice(0, 3)] ?? 0;
}

function brDateParts(date = new Date()): { y: number; m: number; d: number } {
  const [y, m, d] = brToday().split('-').map(Number);
  void date;
  return { y, m, d };
}

function shiftBrDate(y: number, m: number, d: number, days: number): string {
  const shifted = new Date(Date.UTC(y, m - 1, d + days, 15, 0, 0));
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(shifted);
}

function brWeekBounds(): { start: string; end: string } {
  const { y, m, d } = brDateParts();
  const weekday = brWeekday();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const start = shiftBrDate(y, m, d, mondayOffset);
  const end = shiftBrDate(y, m, d, mondayOffset + 6);
  return { start, end };
}

interface SchedulePatient {
  id: string;
  name: string;
  birth_date: string | null;
  foto_url: string | null;
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
      .select('id, name, birth_date, foto_url')
      .eq('professional_id', professional.id)
      .eq('status_vinculo', 'ativo')
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
          ? { id: patient.id, name: patient.name, birth_date: patient.birth_date, foto_url: patient.foto_url ?? null }
          : null,
      };
    });

    // 4. Alertas da família — diary_entries dos últimos 7 dias (não dispensados)
    let alerts: Array<Record<string, unknown>> = [];
    if (patientIds.length > 0) {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [{ data: diaryData, error: diaryError }, { data: dismissedData, error: dismissedError }] =
        await Promise.all([
          supabase
            .from('diary_entries')
            .select('id, patient_id, entry_date, mood_score, sleep_quality, crisis_occurred, crisis_level, notes, created_at')
            .in('patient_id', patientIds)
            .is('deleted_at', null)
            .gte('created_at', since)
            .order('created_at', { ascending: false })
            .limit(50),
          supabase
            .from('professional_dashboard_dismissals')
            .select('diary_entry_id')
            .eq('professional_id', professional.id),
        ]);

      if (diaryError) {
        throw new AppError({ code: 'DIARY_FETCH_FAILED', message: diaryError.message, statusCode: 500 });
      }

      if (dismissedError) {
        throw new AppError({ code: 'DISMISSALS_FETCH_FAILED', message: dismissedError.message, statusCode: 500 });
      }

      const dismissedIds = new Set((dismissedData ?? []).map((d) => d.diary_entry_id as string));

      alerts = (diaryData ?? [])
        .filter((d) => !dismissedIds.has(d.id as string))
        .slice(0, 20)
        .map((d) => {
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

    const { start: weekStart, end: weekEnd } = brWeekBounds();
    const { count: sessionsThisWeek, error: weekCountError } = await supabase
      .from('therapist_schedule')
      .select('id', { count: 'exact', head: true })
      .eq('professional_id', professional.id)
      .is('deleted_at', null)
      .gte('scheduled_at', `${weekStart}T00:00:00-03:00`)
      .lte('scheduled_at', `${weekEnd}T23:59:59-03:00`);

    if (weekCountError) {
      throw new AppError({ code: 'WEEK_SCHEDULE_COUNT_FAILED', message: weekCountError.message, statusCode: 500 });
    }

    return successResponse(
      {
        professional: { id: professional.id, name: professional.name },
        date: day,
        schedule,
        alerts,
        summary: {
          sessions_today: schedule.length,
          sessions_this_week: sessionsThisWeek ?? 0,
          active_patients_count: patients.length,
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
