import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ForbiddenError, NotFoundError } from '../_shared/errors.ts';
import { assertFamilyOwnsPatient } from '../_shared/family-access.ts';
import { extractFamilyReportText } from '../_shared/family-session-report.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type { GetFamilySessionDetailPayload, GetFamilySessionDetailResponse } from './types.ts';

interface SessionRow {
  id: string;
  patient_id: string;
  created_at: string;
  status: string;
  visivel_familia: boolean;
  content: unknown;
  schedule_id: string | null;
  professionals: { name: string } | null;
}

export async function getFamilySessionDetail(
  payload: GetFamilySessionDetailPayload,
  caller: AuthenticatedUser,
): Promise<GetFamilySessionDetailResponse> {
  const link = await assertFamilyOwnsPatient(caller.id, payload.patient_id);
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('session_notes')
    .select('id, patient_id, created_at, status, visivel_familia, content, schedule_id, professionals(name)')
    .eq('id', payload.session_note_id)
    .eq('patient_id', link.patient_id)
    .eq('status', 'approved')
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    throw new AppError({ code: 'SESSION_FETCH_FAILED', message: error.message, statusCode: 500 });
  }

  if (!data) {
    throw new NotFoundError('Sessão não encontrada');
  }

  const row = data as SessionRow;
  if (row.patient_id !== link.patient_id) {
    throw new ForbiddenError('Você não tem acesso a esta sessão');
  }

  let scheduledTime: string | null = null;
  let durationMinutes: number | null = null;
  let sessionTitle = 'Sessão de terapia';

  if (row.schedule_id) {
    const { data: schedule } = await supabase
      .from('therapist_schedule')
      .select('scheduled_at, duration_minutes, title')
      .eq('id', row.schedule_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (schedule) {
      const sched = schedule as { scheduled_at: string; duration_minutes: number; title: string | null };
      scheduledTime = new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo',
      }).format(new Date(sched.scheduled_at));
      durationMinutes = sched.duration_minutes;
      if (sched.title?.trim()) sessionTitle = sched.title.trim();
    }
  }

  const reportShared = row.visivel_familia === true;
  const familyReport = reportShared ? extractFamilyReportText(row.content) || null : null;

  return {
    id: row.id,
    patient_id: link.patient_id,
    patient_name: link.patient_name,
    data_sessao: row.created_at,
    therapist_name: row.professionals?.name ?? 'Profissional',
    status_nota: row.status,
    session_title: sessionTitle,
    scheduled_time: scheduledTime,
    duration_minutes: durationMinutes,
    report_shared: reportShared,
    family_report: familyReport,
  };
}
