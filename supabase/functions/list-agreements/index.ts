import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';

/**
 * list-agreements — Combinados do(s) paciente(s) vinculado(s) à família.
 * Isolamento: apenas pacientes em patient_family_links do auth.uid().
 */
serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const user = await authenticateRequest(req);
    requireRole(user, ['family']);

    const supabase = createServiceClient();

    const { data: links } = await supabase
      .from('patient_family_links')
      .select('patient_id')
      .eq('user_id', user.id);

    const patientIds = [...new Set((links ?? []).map((l) => l.patient_id))];
    if (patientIds.length === 0) {
      return successResponse({ agreements: [] }, req, 200);
    }

    const { data: agreements, error } = await supabase
      .from('agreements')
      .select('id, patient_id, title, description, status, completed_at, created_at')
      .in('patient_id', patientIds)
      .is('deleted_at', null)
      .order('status', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw new AppError({ code: 'FETCH_FAILED', message: error.message, statusCode: 500 });

    return successResponse({ agreements: agreements ?? [] }, req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
