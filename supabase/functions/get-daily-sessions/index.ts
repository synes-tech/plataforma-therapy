import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ValidationError } from '../_shared/errors.ts';
import {
  resolveEffectiveScheduleStatus,
  shouldPersistNotCompleted,
  type ScheduleLifecycleRow,
} from '../_shared/schedule-lifecycle.ts';

/**
 * get-daily-sessions
 *
 * Retorna sessões do terapeuta para um dia (date) ou intervalo (start_date + end_date).
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_LIST_DAYS = 90;
const DEFAULT_LIST_DAYS = 30;

function brTodayISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y!, (m ?? 1) - 1, d);
  date.setDate(date.getDate() + days);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

async function fetchSessionsForRange(
  supabase: ReturnType<typeof createServiceClient>,
  professionalId: string,
  rangeStart: string,
  rangeEndExclusive: string,
) {
  const { data: rows, error } = await supabase
    .from('therapist_schedule')
    .select('id, patient_id, title, scheduled_at, duration_minutes, status, started_at, completed_at, session_note_id')
    .eq('professional_id', professionalId)
    .is('deleted_at', null)
    .gte('scheduled_at', rangeStart)
    .lt('scheduled_at', rangeEndExclusive)
    .order('scheduled_at', { ascending: true });

  if (error) {
    throw new AppError({ code: 'FETCH_FAILED', message: error.message, statusCode: 500 });
  }

  const scheduleRows = (rows ?? []) as ScheduleLifecycleRow[];
  const idsToMarkNotCompleted = scheduleRows
    .filter((r) => shouldPersistNotCompleted(r))
    .map((r) => r.id);

  if (idsToMarkNotCompleted.length > 0) {
    await supabase
      .from('therapist_schedule')
      .update({ status: 'not_completed' })
      .in('id', idsToMarkNotCompleted);
  }

  const patientIds = [...new Set(scheduleRows.map((r) => r.patient_id).filter(Boolean))] as string[];

  const patientMap = new Map<string, { id: string; name: string; birth_date: string | null; foto_url: string | null }>();
  if (patientIds.length > 0) {
    const { data: patients } = await supabase
      .from('patients')
      .select('id, name, birth_date, foto_url')
      .in('id', patientIds);
    (patients ?? []).forEach((p) => patientMap.set(p.id, p));
  }

  const contactMap = new Map<string, { name: string; phone: string | null; email: string | null }>();
  if (patientIds.length > 0) {
    const { data: fams } = await supabase
      .from('family_members')
      .select('patient_id, name, phone, email')
      .in('patient_id', patientIds)
      .is('deleted_at', null);
    (fams ?? []).forEach((f) => {
      if (f.patient_id && !contactMap.has(f.patient_id)) {
        contactMap.set(f.patient_id, { name: f.name, phone: f.phone, email: f.email });
      }
    });
  }

  return scheduleRows.map((r) => {
    const patient = r.patient_id ? patientMap.get(r.patient_id) ?? null : null;
    const contact = r.patient_id ? contactMap.get(r.patient_id) ?? null : null;
    const effectiveStatus = resolveEffectiveScheduleStatus(
      idsToMarkNotCompleted.includes(r.id) ? { ...r, status: 'not_completed' } : r,
    );
    return {
      id: r.id,
      scheduled_at: r.scheduled_at,
      duration_minutes: r.duration_minutes,
      status: effectiveStatus,
      started_at: r.started_at,
      completed_at: r.completed_at,
      session_note_id: r.session_note_id,
      title: r.title,
      patient: patient
        ? { id: patient.id, name: patient.name, birth_date: patient.birth_date, foto_url: patient.foto_url ?? null }
        : null,
      contact,
    };
  });
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const user = await authenticateRequest(req);
    requireRole(user, ['professional']);

    const body = await req.json().catch(() => ({}));
    const view = body.view === 'list' ? 'list' : null;
    const startDate = typeof body.start_date === 'string' ? body.start_date : '';
    const endDate = typeof body.end_date === 'string' ? body.end_date : '';
    const date = String(body.date ?? '');

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

    if (view === 'list') {
      const includePast = body.include_past === true;
      const daysAhead =
        typeof body.days_ahead === 'number' && body.days_ahead > 0
          ? Math.min(Math.floor(body.days_ahead), MAX_LIST_DAYS)
          : DEFAULT_LIST_DAYS;

      const todayBR = brTodayISO();
      let rangeStartDate =
        startDate && DATE_RE.test(startDate) ? startDate : todayBR;
      let rangeEndDate =
        endDate && DATE_RE.test(endDate) ? endDate : addDaysISO(rangeStartDate, daysAhead);

      if (!includePast && rangeStartDate < todayBR) {
        rangeStartDate = todayBR;
      }
      if (rangeStartDate > rangeEndDate) {
        throw new ValidationError({ end_date: 'end_date deve ser igual ou posterior a start_date.' });
      }

      const rangeStart = `${rangeStartDate}T00:00:00-03:00`;
      const rangeEndExclusive = `${addDaysISO(rangeEndDate, 1)}T00:00:00-03:00`;
      let sessions = await fetchSessionsForRange(
        supabase,
        professional.id,
        rangeStart,
        rangeEndExclusive,
      );

      if (!includePast) {
        const now = Date.now();
        sessions = sessions.filter((s) => new Date(s.scheduled_at).getTime() >= now);
      }

      return successResponse(
        { view: 'list', start_date: rangeStartDate, end_date: rangeEndDate, sessions },
        req,
        200,
      );
    }

    if (startDate || endDate) {
      if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
        throw new ValidationError({
          start_date: 'Informe start_date e end_date no formato YYYY-MM-DD.',
        });
      }
      if (startDate > endDate) {
        throw new ValidationError({ end_date: 'end_date deve ser igual ou posterior a start_date.' });
      }

      const rangeStart = `${startDate}T00:00:00-03:00`;
      const rangeEndExclusive = `${addDaysISO(endDate, 1)}T00:00:00-03:00`;
      const sessions = await fetchSessionsForRange(
        supabase,
        professional.id,
        rangeStart,
        rangeEndExclusive,
      );

      return successResponse({ start_date: startDate, end_date: endDate, sessions }, req, 200);
    }

    if (!DATE_RE.test(date)) {
      throw new ValidationError({ date: 'Informe date ou start_date/end_date no formato YYYY-MM-DD.' });
    }

    const dayStart = `${date}T00:00:00-03:00`;
    const dayEndExclusive = `${addDaysISO(date, 1)}T00:00:00-03:00`;
    const sessions = await fetchSessionsForRange(supabase, professional.id, dayStart, dayEndExclusive);

    return successResponse({ date, sessions }, req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
