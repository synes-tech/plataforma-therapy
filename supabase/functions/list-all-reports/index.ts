import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ValidationError } from '../_shared/errors.ts';
import { listAllReportsSchema } from './schema.ts';
import { listAllReports } from './service.ts';

/**
 * list-all-reports
 *
 * Retorna TODOS os relatórios (session_notes) do terapeuta autenticado,
 * cruzando com nomes dos pacientes. Suporta paginação e filtro por status.
 *
 * Método: POST
 * Body: { page?: number, per_page?: number, status?: string, patient_id?: string, search?: string }
 * Response: { items: ReportItem[], pagination: {...} }
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

    const body = await req.json().catch(() => ({}));
    const parsed = listAllReportsSchema.safeParse(body);

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

    const result = await listAllReports(supabase, professional.id, parsed.data);

    // Structured log
    console.log(JSON.stringify({
      level: 'info',
      trace_id: req.headers.get('x-request-id') ?? crypto.randomUUID(),
      function: 'list-all-reports',
      user_id: user.id,
      clinic_id: user.clinic_id,
      action: 'reports_listed',
      total: result.pagination.total,
      page: result.pagination.page,
      timestamp: new Date().toISOString(),
    }));

    return successResponse(result, req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
