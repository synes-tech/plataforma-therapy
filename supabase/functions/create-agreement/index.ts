import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ValidationError, ForbiddenError } from '../_shared/errors.ts';

/**
 * create-agreement — Terapeuta envia um "Combinado" para a família de um
 * paciente (liga ao "Salvar no plano" do Copiloto). Isolamento por posse.
 */
serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return errorResponse(new ValidationError({ method: 'Only POST is allowed' }), req);
    }

    const user = await authenticateRequest(req);
    requireRole(user, ['professional']);

    const body = await req.json().catch(() => ({}));
    const patientId = String(body.patient_id ?? '');
    const title = String(body.title ?? '').trim();
    const description = body.description ? String(body.description) : null;

    if (!patientId || title.length < 2) {
      throw new ValidationError({ title: 'patient_id e title (>=2 chars) são obrigatórios.' });
    }

    const supabase = createServiceClient();

    const { data: professional } = await supabase
      .from('professionals')
      .select('id, clinic_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (!professional) throw new AppError({ code: 'NO_ACCESS', message: 'Profissional não encontrado', statusCode: 403 });

    // Verifica posse do paciente
    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .eq('id', patientId)
      .eq('professional_id', professional.id)
      .is('deleted_at', null)
      .single();

    if (!patient) throw new ForbiddenError('Paciente não encontrado ou não vinculado a você.');

    const { data: created, error } = await supabase
      .from('agreements')
      .insert({
        patient_id: patientId,
        clinic_id: professional.clinic_id,
        professional_id: professional.id,
        title,
        description,
        status: 'pending',
        created_by: user.id,
      })
      .select('id, title, status, created_at')
      .single();

    if (error) throw new AppError({ code: 'CREATE_FAILED', message: error.message, statusCode: 500 });

    return successResponse(created, req, 201);
  } catch (error) {
    return errorResponse(error, req);
  }
});
