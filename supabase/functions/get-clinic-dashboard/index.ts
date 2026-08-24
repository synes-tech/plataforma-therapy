import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';

const BR_TZ = 'America/Sao_Paulo';
const CAPACITY_MINUTES = 40 * 60;

function brToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function brWeekday(): number {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: BR_TZ, weekday: 'short' }).format(new Date());
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd.slice(0, 3)] ?? 0;
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
  const [y, m, d] = brToday().split('-').map(Number);
  const mondayOffset = brWeekday() === 0 ? -6 : 1 - brWeekday();
  return {
    start: shiftBrDate(y, m, d, mondayOffset),
    end: shiftBrDate(y, m, d, mondayOffset + 6),
  };
}

function brDayFromIso(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const user = await authenticateRequest(req);
    requireRole(user, ['clinic_admin', 'master']);

    const supabase = createServiceClient();

    let clinicId = user.clinic_id;

    if (!clinicId) {
      const { data: adminRecord } = await supabase
        .from('clinic_admins')
        .select('clinic_id, name')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .single();

      if (!adminRecord) {
        throw new AppError({
          code: 'NO_CLINIC',
          message: 'Usuário não vinculado a uma clínica',
          statusCode: 400,
        });
      }
      clinicId = adminRecord.clinic_id;
    }

    const { data: admin } = await supabase
      .from('clinic_admins')
      .select('name')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();

    const { data: clinic } = await supabase
      .from('clinics')
      .select('name, subscription_plan')
      .eq('id', clinicId)
      .is('deleted_at', null)
      .single();

    if (!clinic) {
      throw new AppError({ code: 'NOT_FOUND', message: 'Clínica não encontrada', statusCode: 404 });
    }

    const day = brToday();
    const { start: weekStart, end: weekEnd } = brWeekBounds();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [
      { data: settings },
      { count: professionalsCount },
      { data: professionals },
      { data: patients },
    ] = await Promise.all([
      supabase.from('clinic_settings').select('max_professionals').eq('clinic_id', clinicId).single(),
      supabase.from('professionals').select('id', { count: 'exact', head: true }).eq('clinic_id', clinicId).is('deleted_at', null),
      supabase
        .from('professionals')
        .select('id, name, specialty, status, created_at')
        .eq('clinic_id', clinicId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('patients')
        .select('id')
        .eq('clinic_id', clinicId)
        .eq('status_vinculo', 'ativo')
        .is('deleted_at', null),
    ]);

    const patientIds = (patients ?? []).map((row) => row.id);
    const professionalIds = (professionals ?? []).map((row) => row.id);

    const [{ data: weekSchedule }, { count: aiReportsCount }, { data: familyLinks }, { data: crises }] =
      await Promise.all([
        professionalIds.length === 0
          ? Promise.resolve({ data: [] })
          : supabase
              .from('therapist_schedule')
              .select('id, professional_id, patient_id, scheduled_at, duration_minutes, status')
              .eq('clinic_id', clinicId)
              .is('deleted_at', null)
              .gte('scheduled_at', `${weekStart}T00:00:00-03:00`)
              .lte('scheduled_at', `${weekEnd}T23:59:59-03:00`)
              .order('scheduled_at', { ascending: true }),
        patientIds.length === 0
          ? Promise.resolve({ count: 0 })
          : supabase
              .from('session_notes')
              .select('id', { count: 'exact', head: true })
              .in('patient_id', patientIds)
              .gte('created_at', monthStart.toISOString())
              .is('deleted_at', null),
        patientIds.length === 0
          ? Promise.resolve({ data: [] })
          : supabase.from('patient_family_links').select('patient_id').in('patient_id', patientIds).not('user_id', 'is', null),
        patientIds.length === 0
          ? Promise.resolve({ data: [] })
          : supabase
              .from('diary_entries')
              .select('id')
              .in('patient_id', patientIds)
              .eq('crisis_occurred', true)
              .is('deleted_at', null)
              .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
      ]);

    const patientNameById = new Map<string, string>();
    if (patientIds.length > 0) {
      const { data: named } = await supabase.from('patients').select('id, name').in('id', patientIds);
      (named ?? []).forEach((row) => patientNameById.set(row.id, row.name));
    }

    const todayRows = (weekSchedule ?? []).filter((row) => brDayFromIso(row.scheduled_at as string) === day);
    const linked = new Set((familyLinks ?? []).map((row) => row.patient_id as string));

    const teamToday = (professionals ?? []).map((pro) => {
      const rows = todayRows
        .filter((row) => row.professional_id === pro.id)
        .sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)));
      const upcoming = rows.find((row) => new Date(row.scheduled_at as string).getTime() >= Date.now());
      const next = upcoming ?? rows[0];
      return {
        id: pro.id,
        name: pro.name,
        specialty: pro.specialty,
        sessions_today: rows.length,
        next_at: next?.scheduled_at ?? null,
        next_patient: next?.patient_id ? patientNameById.get(next.patient_id as string) ?? null : null,
      };
    });

    const weekByProfessional = (professionals ?? []).map((pro) => ({
      id: pro.id,
      name: pro.name,
      sessions: (weekSchedule ?? []).filter((row) => row.professional_id === pro.id).length,
    }));

    const bookedMinutes = (weekSchedule ?? []).reduce((sum, row) => {
      if (['cancelled', 'canceled', 'no_show'].includes(row.status as string)) return sum;
      const minutes = Number(row.duration_minutes);
      return sum + (Number.isFinite(minutes) && minutes > 0 ? minutes : 50);
    }, 0);
    const capacity = Math.max(CAPACITY_MINUTES, (professionals ?? []).length * CAPACITY_MINUTES);
    const occupancyPct = Math.min(100, Math.round((bookedMinutes / capacity) * 100));

    return successResponse(
      {
        admin_name: admin?.name ?? user.email.split('@')[0],
        clinic_name: clinic.name,
        subscription_plan: clinic.subscription_plan,
        professionals_count: professionalsCount ?? 0,
        max_professionals: settings?.max_professionals ?? 10,
        patients_count: patientIds.length,
        ai_reports_this_month: aiReportsCount ?? 0,
        sessions_today: todayRows.length,
        occupancy_pct: occupancyPct,
        pending_family_links: patientIds.filter((id) => !linked.has(id)).length,
        crisis_alerts_count: (crises ?? []).length,
        team_today: teamToday,
        week_by_professional: weekByProfessional,
        recent_professionals: (professionals ?? []).slice(0, 5),
      },
      req,
      200,
    );
  } catch (error) {
    return errorResponse(error, req);
  }
});
