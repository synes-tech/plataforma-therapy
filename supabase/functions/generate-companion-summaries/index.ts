import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { ValidationError } from '../_shared/errors.ts';
import { assertCronAuth } from '../_shared/cron-auth.ts';
import { GenerateCompanionSummariesSchema } from './schema.ts';
import { generateCompanionSummaries } from './service.ts';

/**
 * Job semanal (Cloud Scheduler + CRON_SECRET).
 * Lê o chat isolado, gera resumo consentido e vetoriza SÓ o resumo (ADR-06).
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
    const parsed = GenerateCompanionSummariesSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(new ValidationError(parsed.error.flatten().fieldErrors), req);
    }

    const response = await generateCompanionSummaries(parsed.data);
    return successResponse(response, req);
  } catch (error) {
    return errorResponse(error, req);
  }
});
