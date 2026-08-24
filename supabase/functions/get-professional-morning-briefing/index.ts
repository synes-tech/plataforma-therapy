import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';

/**
 * get-professional-morning-briefing
 *
 * Resumo operacional do terapeuta: agenda do dia, inbox, pulso da carteira e
 * (quando autônomo) pulso do caixa dos próprios pacientes.
 */

const BR_TZ = 'America/Sao_Paulo';
const WEEKDAY_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MONTH_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const CAPACITY_MINUTES = 40 * 60;
const CANCELLED = new Set(['cancelled', 'canceled', 'no_show']);
const COMPLETED_LIST_LIMIT = 50;

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

function brDateParts(): { y: number; m: number; d: number } {
  const [y, m, d] = brToday().split('-').map(Number);
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
  return {
    start: shiftBrDate(y, m, d, mondayOffset),
    end: shiftBrDate(y, m, d, mondayOffset + 6),
  };
}

function last7Days(): string[] {
  const { y, m, d } = brDateParts();
  return Array.from({ length: 7 }, (_, index) => shiftBrDate(y, m, d, index - 6));
}

function brDayFromIso(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

function weekdayLabel(date: string): string {
  const value = new Date(`${date}T12:00:00-03:00`);
  return WEEKDAY_SHORT[value.getDay()] ?? date;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function daysInMonth(y: number, m: number): string[] {
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: last }, (_, index) => `${y}-${pad2(m)}-${pad2(index + 1)}`);
}

function isCancelledStatus(status: unknown): boolean {
  return CANCELLED.has(String(status ?? ''));
}

function countSessionsOnDay(
  rows: Array<{ scheduled_at: string; status: string }>,
  date: string,
): number {
  return rows.filter((row) => !isCancelledStatus(row.status) && brDayFromIso(row.scheduled_at) === date).length;
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

    const { data: professional } = await supabase
      .from('professionals')
      .select('id, name, clinic_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (!professional) {
      throw new AppError({ code: 'NO_ACCESS', message: 'Profissional não encontrado', statusCode: 403 });
    }

    const { data: patientsData } = await supabase
      .from('patients')
      .select('id, name, birth_date, foto_url')
      .eq('professional_id', professional.id)
      .eq('status_vinculo', 'ativo')
      .is('deleted_at', null);

    const patients = (patientsData ?? []) as SchedulePatient[];
    const patientMap = new Map(patients.map((p) => [p.id, p]));
    const patientIds = patients.map((p) => p.id);

    const day = brToday();
    const { y, m, d } = brDateParts();
    const days7 = last7Days();
    const staleFrom = shiftBrDate(y, m, d, -21);
    const { start: weekStart, end: weekEnd } = brWeekBounds();
    const yearStart = `${y}-01-01`;
    const yearEnd = `${y}-12-31`;
    const monthDays = daysInMonth(y, m);

    const { data: yearSchedule, error: weekError } = await supabase
      .from('therapist_schedule')
      .select('id, patient_id, title, scheduled_at, duration_minutes, status, notes')
      .eq('professional_id', professional.id)
      .is('deleted_at', null)
      .gte('scheduled_at', `${yearStart}T00:00:00-03:00`)
      .lte('scheduled_at', `${yearEnd}T23:59:59-03:00`)
      .order('scheduled_at', { ascending: true })
      .limit(8000);

    if (weekError) {
      throw new AppError({ code: 'SCHEDULE_FETCH_FAILED', message: weekError.message, statusCode: 500 });
    }

    const yearRows = (yearSchedule ?? []) as Array<{
      id: string;
      patient_id: string | null;
      title: string | null;
      scheduled_at: string;
      duration_minutes: number | null;
      status: string;
      notes: string | null;
    }>;
    const allRecent = yearRows.filter((row) => brDayFromIso(row.scheduled_at) >= staleFrom);
    const todayRows = yearRows.filter((row) => brDayFromIso(row.scheduled_at) === day);
    const weekRows = yearRows.filter((row) => {
      const key = brDayFromIso(row.scheduled_at);
      return key >= weekStart && key <= weekEnd;
    });

    const monthStart = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`;
    const monthEnd = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;

    const notesSelect = 'id, patient_id, status, created_at, schedule_id, ai_generated';
    const [{ data: diaryData }, { data: dismissedData }, { data: notesData }, { data: familyLinks }, { data: monthDiary }, notesTotalRes, notesAiRes, { data: recentNotesData }, { data: todayNotesData }] =
      await Promise.all([
        patientIds.length === 0
          ? Promise.resolve({ data: [] })
          : supabase
              .from('diary_entries')
              .select('id, patient_id, entry_date, mood_score, sleep_quality, crisis_occurred, crisis_level, notes, created_at')
              .in('patient_id', patientIds)
              .is('deleted_at', null)
              .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
              .order('created_at', { ascending: false })
              .limit(50),
        supabase
          .from('professional_dashboard_dismissals')
          .select('diary_entry_id')
          .eq('professional_id', professional.id),
        supabase
          .from('session_notes')
          .select(notesSelect)
          .eq('professional_id', professional.id)
          .is('deleted_at', null)
          .gte('created_at', `${shiftBrDate(y, m, d, -7)}T00:00:00-03:00`)
          .order('created_at', { ascending: false }),
        patientIds.length === 0
          ? Promise.resolve({ data: [] })
          : supabase.from('patient_family_links').select('patient_id').in('patient_id', patientIds).not('user_id', 'is', null),
        patientIds.length === 0
          ? Promise.resolve({ data: [] })
          : supabase
              .from('diary_entries')
              .select('id, entry_date, patient_id, crisis_occurred, created_at')
              .in('patient_id', patientIds)
              .is('deleted_at', null)
              .gte('entry_date', monthStart)
              .lte('entry_date', monthEnd)
              .order('created_at', { ascending: false }),
        supabase
          .from('session_notes')
          .select('id', { count: 'exact', head: true })
          .eq('professional_id', professional.id)
          .is('deleted_at', null),
        supabase
          .from('session_notes')
          .select('id', { count: 'exact', head: true })
          .eq('professional_id', professional.id)
          .eq('ai_generated', true)
          .is('deleted_at', null),
        supabase
          .from('session_notes')
          .select(notesSelect)
          .eq('professional_id', professional.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(COMPLETED_LIST_LIMIT),
        supabase
          .from('session_notes')
          .select(notesSelect)
          .eq('professional_id', professional.id)
          .is('deleted_at', null)
          .gte('created_at', `${day}T00:00:00-03:00`)
          .lte('created_at', `${day}T23:59:59-03:00`)
          .order('created_at', { ascending: false })
          .limit(COMPLETED_LIST_LIMIT),
      ]);

    const dismissedIds = new Set((dismissedData ?? []).map((row) => row.diary_entry_id as string));
    const linkedIds = new Set((familyLinks ?? []).map((row) => row.patient_id as string));

    const noteByDay = new Map<string, { status: string; id: string }>();
    for (const note of notesData ?? []) {
      const key = `${note.patient_id}|${brDayFromIso(note.created_at as string)}`;
      const existing = noteByDay.get(key);
      if (!existing || (existing.status !== 'approved' && note.status === 'approved')) {
        noteByDay.set(key, { status: note.status as string, id: note.id as string });
      }
    }

    const schedule = todayRows.map((row) => {
      const patient = row.patient_id ? patientMap.get(row.patient_id as string) ?? null : null;
      const note = row.patient_id ? noteByDay.get(`${row.patient_id}|${day}`) ?? null : null;
      let evolutionStatus: 'pending' | 'draft' | 'approved' = 'pending';
      if (note?.status === 'approved') evolutionStatus = 'approved';
      else if (note) evolutionStatus = 'draft';
      return {
        id: row.id,
        title: row.title,
        scheduled_at: row.scheduled_at,
        duration_minutes: row.duration_minutes,
        status: row.status,
        evolution_status: evolutionStatus,
        session_note_id: note?.id ?? null,
        patient: patient
          ? { id: patient.id, name: patient.name, birth_date: patient.birth_date, foto_url: patient.foto_url ?? null }
          : null,
      };
    });

    const alerts = (diaryData ?? [])
      .filter((entry) => !dismissedIds.has(entry.id as string))
      .slice(0, 20)
      .map((entry) => {
        const patient = patientMap.get(entry.patient_id as string) ?? null;
        const hoursAgo = Math.max(
          0,
          Math.round((Date.now() - new Date(entry.created_at as string).getTime()) / (60 * 60 * 1000)),
        );
        return {
          id: entry.id,
          type: entry.crisis_occurred ? 'crisis' : 'positive',
          patient: patient ? { id: patient.id, name: patient.name } : null,
          entry_date: entry.entry_date,
          mood_score: entry.mood_score,
          sleep_quality: entry.sleep_quality,
          crisis_occurred: entry.crisis_occurred,
          crisis_level: entry.crisis_level,
          notes: entry.notes,
          created_at: entry.created_at,
          hours_ago: hoursAgo,
        };
      });

    const pendingNotes = schedule
      .filter((item) => item.patient && item.evolution_status !== 'approved' && item.status !== 'cancelled')
      .map((item) => ({
        patient_id: item.patient!.id,
        patient_name: item.patient!.name,
        schedule_id: item.id,
        status: item.evolution_status,
        scheduled_at: item.scheduled_at,
      }));

    const familyUnlinked = patients
      .filter((patient) => !linkedIds.has(patient.id))
      .map((patient) => ({ id: patient.id, name: patient.name }));

    const seenRecently = new Set(
      allRecent
        .filter((row) => !['cancelled', 'canceled', 'no_show'].includes(row.status as string))
        .map((row) => row.patient_id as string),
    );
    const staleCount = patients.filter((patient) => !seenRecently.has(patient.id)).length;

    const weekDays = days7.map((date) => ({
      date,
      label: weekdayLabel(date),
      count: countSessionsOnDay(yearRows, date),
    }));
    const monthDayPoints = monthDays.map((date) => ({
      date,
      label: String(Number(date.slice(8, 10))),
      count: countSessionsOnDay(yearRows, date),
    }));
    const yearMonthPoints = MONTH_SHORT.map((label, index) => {
      const key = `${y}-${pad2(index + 1)}`;
      return {
        date: key,
        label,
        count: yearRows.filter((row) => !isCancelledStatus(row.status) && brDayFromIso(row.scheduled_at).slice(0, 7) === key).length,
      };
    });

    type NoteRow = {
      id: string;
      patient_id: string;
      status: string;
      created_at: string;
      schedule_id: string | null;
      ai_generated?: boolean | null;
    };
    const recentNotes = (recentNotesData ?? []) as NoteRow[];
    const todayNotes = (todayNotesData ?? []) as NoteRow[];
    const extraPatientIds = [...new Set(
      [...recentNotes, ...todayNotes]
        .map((note) => note.patient_id)
        .filter((id) => id && !patientMap.has(id)),
    )];
    if (extraPatientIds.length > 0) {
      const { data: extraPatients } = await supabase.from('patients').select('id, name, birth_date, foto_url').in('id', extraPatientIds);
      for (const extra of extraPatients ?? []) {
        patientMap.set(extra.id as string, extra as SchedulePatient);
      }
    }

    const noteName = (patientId: string) => patientMap.get(patientId)?.name ?? 'Paciente';
    const itemsTotal = recentNotes.map((note) => ({
      id: note.id,
      patient_id: note.patient_id,
      patient_name: noteName(note.patient_id),
      occurred_at: note.created_at,
      status: note.status,
      title: null as string | null,
      source: 'note' as const,
    }));
    const todayNoteItems = todayNotes.map((note) => ({
      id: note.id,
      patient_id: note.patient_id,
      patient_name: noteName(note.patient_id),
      occurred_at: note.created_at,
      status: note.status,
      title: null as string | null,
      source: 'note' as const,
    }));
    const todayCompletedSchedule = todayRows
      .filter((row) => row.status === 'completed' && row.patient_id)
      .map((row) => ({
        id: row.id,
        patient_id: row.patient_id as string,
        patient_name: noteName(row.patient_id as string),
        occurred_at: row.scheduled_at,
        status: row.status,
        title: row.title,
        source: 'schedule' as const,
      }));
    const todayNoteScheduleIds = new Set(
      todayNotes.map((note) => note.schedule_id).filter((id): id is string => Boolean(id)),
    );
    const itemsToday = [
      ...todayCompletedSchedule.filter((item) => !todayNoteScheduleIds.has(item.id)),
      ...todayNoteItems,
    ].sort((a, b) => String(b.occurred_at).localeCompare(String(a.occurred_at)));

    const completedSessions = {
      total: notesTotalRes.count ?? itemsTotal.length,
      today: itemsToday.length,
      ai_processed: notesAiRes.count ?? 0,
      items_total: itemsTotal,
      items_today: itemsToday,
    };

    const bookedMinutes = weekRows.reduce((sum, row) => {
      if (['cancelled', 'canceled', 'no_show'].includes(row.status as string)) return sum;
      const minutes = Number(row.duration_minutes);
      return sum + (Number.isFinite(minutes) && minutes > 0 ? minutes : 50);
    }, 0);
    const occupancyPct = Math.min(100, Math.round((bookedMinutes / CAPACITY_MINUTES) * 100));

    let finance: {
      received_cents: number;
      receivable_cents: number;
      overdue_cents: number;
      overdue_count: number;
      classify_count: number;
      classify_cents: number;
      expenses_cents: number;
      net_cents: number;
    } | null = null;

    if (user.is_solo && professional.clinic_id) {
      const [{ data: pendingSessions }, { data: txs }, { data: expenseTxs }] = await Promise.all([
        patientIds.length === 0
          ? Promise.resolve({ data: [] })
          : supabase
              .from('financeiro_sessoes_cobranca')
              .select('id, valor_previsto_cents')
              .eq('clinic_id', professional.clinic_id)
              .in('patient_id', patientIds)
              .eq('status_cobranca', 'PENDENTE_CONFIRMACAO')
              .is('deleted_at', null),
        patientIds.length === 0
          ? Promise.resolve({ data: [] })
          : supabase
              .from('financeiro_transacoes')
              .select('valor_cents, status, tipo, data_pagamento')
              .eq('clinic_id', professional.clinic_id)
              .in('paciente_id', patientIds)
              .eq('tipo', 'ENTRADA')
              .in('status', ['PAGO', 'ATRASADO', 'PENDENTE'])
              .is('deleted_at', null),
        supabase
          .from('financeiro_transacoes')
          .select('valor_cents, status, tipo, data_pagamento')
          .eq('clinic_id', professional.clinic_id)
          .eq('tipo', 'SAIDA')
          .eq('status', 'PAGO')
          .is('deleted_at', null)
          .gte('data_pagamento', monthStart)
          .lte('data_pagamento', monthEnd),
      ]);

      const received = (txs ?? [])
        .filter((row) => row.status === 'PAGO' && String(row.data_pagamento ?? '').slice(0, 7) === day.slice(0, 7))
        .reduce((sum, row) => sum + Number(row.valor_cents), 0);
      const receivable = (txs ?? [])
        .filter((row) => row.status === 'PENDENTE')
        .reduce((sum, row) => sum + Number(row.valor_cents), 0);
      const overdueRows = (txs ?? []).filter((row) => row.status === 'ATRASADO');
      const expenses = (expenseTxs ?? []).reduce((sum, row) => sum + Number(row.valor_cents), 0);
      finance = {
        received_cents: received,
        receivable_cents: receivable,
        overdue_cents: overdueRows.reduce((sum, row) => sum + Number(row.valor_cents), 0),
        overdue_count: overdueRows.length,
        classify_count: (pendingSessions ?? []).length,
        classify_cents: (pendingSessions ?? []).reduce((sum, row) => sum + Number(row.valor_previsto_cents ?? 0), 0),
        expenses_cents: expenses,
        net_cents: received - expenses,
      };
    }

    return successResponse(
      {
        professional: { id: professional.id, name: professional.name },
        date: day,
        schedule,
        alerts,
        week_days: weekDays,
        month_days: monthDayPoints,
        year_months: yearMonthPoints,
        completed_sessions: completedSessions,
        portfolio: {
          with_family: patients.length - familyUnlinked.length,
          without_family: familyUnlinked.length,
          stale_21d: staleCount,
        },
        pending_notes: pendingNotes,
        family_unlinked: familyUnlinked.slice(0, 5),
        diary_month: {
          month: day.slice(0, 7),
          days: [...new Set((monthDiary ?? []).map((row) => String(row.entry_date)))].sort(),
          entries: (monthDiary ?? []).map((row) => {
            const patient = patientMap.get(row.patient_id as string);
            return {
              id: row.id as string,
              entry_date: String(row.entry_date),
              patient_id: row.patient_id as string,
              patient_name: patient?.name ?? 'Paciente',
              foto_url: patient?.foto_url ?? null,
              crisis_occurred: Boolean(row.crisis_occurred),
              created_at: (row.created_at as string | null) ?? null,
            };
          }),
        },
        finance,
        summary: {
          sessions_today: schedule.length,
          sessions_this_week: weekRows.length,
          active_patients_count: patients.length,
          alerts_count: alerts.length,
          crisis_count: alerts.filter((alert) => alert.type === 'crisis').length,
          pending_notes_count: pendingNotes.length,
          family_unlinked_count: familyUnlinked.length,
          occupancy_pct: occupancyPct,
          sessions_completed_total: completedSessions.total,
          sessions_completed_today: completedSessions.today,
        },
      },
      req,
      200,
    );
  } catch (error) {
    return errorResponse(error, req);
  }
});
