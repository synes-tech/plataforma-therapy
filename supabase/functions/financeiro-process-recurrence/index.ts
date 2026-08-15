import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { ValidationError } from '../_shared/errors.ts';
import { assertCronAuth } from '../_shared/cron-auth.ts';
import { processFinancialRecurrence } from './service.ts';

/**
 * financeiro-process-recurrence — Cloud Scheduler (01:00 America/Sao_Paulo)
 * Gera faturas do mês atual + seguinte, expande agenda e marca atrasados.
 * Auth: header X-Cron-Secret (sem JWT de usuário).
 */
serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return errorResponse(new ValidationError({ method: 'Only POST is allowed' }), req);
    }

    assertCronAuth(req);

    const body = await req.json().catch(() => ({}));
    const yearMonth = typeof body.year_month === 'string' ? body.year_month : undefined;
    const result = await processFinancialRecurrence(yearMonth);
    return successResponse(result, req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
