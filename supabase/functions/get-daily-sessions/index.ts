import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ValidationError } from '../_shared/errors.ts';

/**
 * get-daily-sessions
 *
 * Disparada ao clicar em um dia. Retorna as sessões completas daquela data
 * (fuso BR) do terapeuta autenticado, com paciente e contato da família para
 * as ações rápidas (remarcar / contato / lembrete).
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const user = await authenticateRequest(req);
    requireRole(user, ['professional']);

    const body = await req.json().catch(() => ({}));
    const date = String(body.date ?? '');
    if (!DATE_RE.test(date)) {
      throw new ValidationError({ date: 'Informe date no formato YYYY-MM-DD.' });
    }

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

    const dayStart = `${date}T00:00:00-03:00`;
    const dayEnd = `${date}T23:59:59-03:00`;

    const { data: rows, error } = await supabase
      .from('therapist_schedule')
      .select('id, patient_id, title, scheduled_at, duration_minutes, status')
      .eq('professional_id', professional.id)
      .is('deleted_at', null)
      .gte('scheduled_at', dayStart)
      .lte('scheduled_at', dayEnd)
      .order('scheduled_at', { ascending: true });

    if (error) {
      throw new AppError({ code: 'FETCH_FAILED', message: error.message, statusCode: 500 });
    }

    const patientIds = [...new Set((rows ?? []).map((r) => r.patient_id).filter(Boolean))] as string[];

    // Pacientes
    const patientMap = new Map<string, { id: string; name: string; birth_date: string | null }>();
    if (patientIds.length > 0) {
      const { data: patients } = await supabase
        .from('patients')
        .select('id, name, birth_date')
        .in('id', patientIds);
      (patients ?? []).forEach((p) => patientMap.set(p.id, p));
    }

    // Contato da família (primeiro responsável vinculado)
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

    const sessions = (rows ?? []).map((r) => {
      const patient = r.patient_id ? patientMap.get(r.patient_id) ?? null : null;
      const contact = r.patient_id ? contactMap.get(r.patient_id) ?? null : null;
      return {
        id: r.id,
        scheduled_at: r.scheduled_at,
        duration_minutes: r.duration_minutes,
        status: r.status,
        title: r.title,
        patient: patient ? { id: patient.id, name: patient.name, birth_date: patient.birth_date } : null,
        contact,
      };
    });

    return successResponse({ date, sessions }, req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
