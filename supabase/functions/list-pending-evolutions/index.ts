import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';

/**
 * list-pending-evolutions
 *
 * Alimenta a "Fila de Evoluções" da Central de Relatórios. Retorna a agenda
 * do dia (fuso BR) do terapeuta autenticado, anotada com o status de evolução
 * (pendente / rascunho / aprovada) derivado de session_notes do mesmo paciente
 * na mesma data.
 *
 * Isolamento: filtra estritamente por professional_id do usuário autenticado.
 */

const BR_TZ = 'America/Sao_Paulo';

function brDay(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

type EvolutionStatus = 'pending' | 'draft' | 'approved';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const user = await authenticateRequest(req);
    requireRole(user, ['professional']);

    const supabase = createServiceClient();

    const { data: professional } = await supabase
      .from('professionals')
      .select('id, clinic_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (!professional) {
      throw new AppError({ code: 'NO_ACCESS', message: 'Profissional não encontrado', statusCode: 403 });
    }

    const day = brDay(new Date());
    const dayStart = `${day}T00:00:00-03:00`;
    const dayEnd = `${day}T23:59:59-03:00`;

    // Agenda do dia
    const { data: scheduleData, error: scheduleError } = await supabase
      .from('therapist_schedule')
      .select('id, patient_id, title, scheduled_at, duration_minutes, status')
      .eq('professional_id', professional.id)
      .is('deleted_at', null)
      .gte('scheduled_at', dayStart)
      .lte('scheduled_at', dayEnd)
      .order('scheduled_at', { ascending: true });

    if (scheduleError) {
      throw new AppError({ code: 'SCHEDULE_FETCH_FAILED', message: scheduleError.message, statusCode: 500 });
    }

    // Pacientes (nome)
    const patientIds = [...new Set((scheduleData ?? []).map((s) => s.patient_id).filter(Boolean))] as string[];
    const patientMap = new Map<string, { id: string; name: string }>();
    if (patientIds.length > 0) {
      const { data: patients } = await supabase
        .from('patients')
        .select('id, name')
        .in('id', patientIds);
      (patients ?? []).forEach((p) => patientMap.set(p.id, { id: p.id, name: p.name }));
    }

    // session_notes recentes (últimos 2 dias) para casar por paciente + data
    const { data: notes, error: notesError } = await supabase
      .from('session_notes')
      .select('id, patient_id, status, created_at')
      .eq('professional_id', professional.id)
      .is('deleted_at', null)
      .gte('created_at', `${brDay(new Date(Date.now() - 2 * 86400000))}T00:00:00-03:00`)
      .order('created_at', { ascending: false });

    if (notesError) {
      throw new AppError({ code: 'NOTES_FETCH_FAILED', message: notesError.message, statusCode: 500 });
    }

    // Mapa: `${patient_id}|${YYYY-MM-DD}` -> { status, id }
    const noteMap = new Map<string, { status: string; id: string }>();
    (notes ?? []).forEach((n) => {
      const key = `${n.patient_id}|${brDay(new Date(n.created_at))}`;
      const existing = noteMap.get(key);
      // approved tem prioridade sobre draft
      if (!existing || (existing.status !== 'approved' && n.status === 'approved')) {
        noteMap.set(key, { status: n.status, id: n.id });
      }
    });

    const items = (scheduleData ?? []).map((s) => {
      const patient = s.patient_id ? patientMap.get(s.patient_id) ?? null : null;
      const note = s.patient_id ? noteMap.get(`${s.patient_id}|${day}`) ?? null : null;
      let evolutionStatus: EvolutionStatus = 'pending';
      if (note?.status === 'approved') evolutionStatus = 'approved';
      else if (note) evolutionStatus = 'draft';

      return {
        schedule_id: s.id,
        scheduled_at: s.scheduled_at,
        duration_minutes: s.duration_minutes,
        title: s.title,
        patient,
        evolution_status: evolutionStatus,
        session_note_id: note?.id ?? null,
      };
    });

    return successResponse(
      {
        date: day,
        items,
        summary: {
          total: items.length,
          pending: items.filter((i) => i.evolution_status === 'pending').length,
          done: items.filter((i) => i.evolution_status === 'approved').length,
        },
      },
      req,
      200,
    );
  } catch (error) {
    return errorResponse(error, req);
  }
});
