import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ValidationError } from '../_shared/errors.ts';
import { updateReportSchema } from './schema.ts';
import { updateReport } from './service.ts';

/**
 * update-report
 *
 * Permite ao terapeuta editar o conteúdo SOAP de um session_note (relatório).
 * Valida ownership via professional_id e atualiza o registro.
 *
 * Método: POST
 * Body: { session_note_id: string, content: { subjective?, objective?, assessment?, plan? }, approve?: boolean }
 * Response: { id, status, updated_at }
 */

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      throw new AppError({ code: 'METHOD_NOT_ALLOWED', message: 'Use POST', statusCode: 405 });
    }

    const user = await authenticateRequest(req);
    requireRole(user, ['professional']);

    const body = await req.json();
    const parsed = updateReportSchema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const supabase = createServiceClient();

    // Resolve professional_id from user
    const { data: professional } = await supabase
      .from('professionals')
      .select('id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (!professional) {
      throw new AppError({ code: 'NO_ACCESS', message: 'Profissional não encontrado', statusCode: 403 });
    }

    const result = await updateReport(supabase, professional.id, user.id, parsed.data);

    // Structured log
    console.log(JSON.stringify({
      level: 'info',
      trace_id: req.headers.get('x-request-id') ?? crypto.randomUUID(),
      function: 'update-report',
      user_id: user.id,
      clinic_id: user.clinic_id,
      action: parsed.data.approve ? 'report_approved' : 'report_updated',
      session_note_id: parsed.data.session_note_id,
      timestamp: new Date().toISOString(),
    }));

    return successResponse(result, req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
