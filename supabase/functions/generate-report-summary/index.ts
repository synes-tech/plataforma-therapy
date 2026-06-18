import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ValidationError } from '../_shared/errors.ts';
import { generateReportSummarySchema } from './schema.ts';
import { generateReportSummary } from './service.ts';

/**
 * generate-report-summary
 *
 * Recebe um session_note_id, valida ownership, envia conteúdo SOAP para LLM,
 * e retorna um resumo em bullet points com insights clínicos.
 *
 * Método: POST
 * Body: { session_note_id: string (UUID) }
 * Response: { summary_bullets: string[], session_note_id: string, generated_at: string }
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
    const parsed = generateReportSummarySchema.safeParse(body);

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

    const result = await generateReportSummary(supabase, professional.id, parsed.data.session_note_id);

    // Log for observability
    console.log(JSON.stringify({
      level: 'info',
      trace_id: req.headers.get('x-request-id') ?? crypto.randomUUID(),
      function: 'generate-report-summary',
      user_id: user.id,
      clinic_id: user.clinic_id,
      action: 'summary_generated',
      session_note_id: parsed.data.session_note_id,
      bullets_count: result.summary_bullets.length,
      timestamp: new Date().toISOString(),
    }));

    return successResponse(result, req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
