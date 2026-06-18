import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole, logAuthEvent } from '../_shared/auth.ts';
import { AppError } from '../_shared/errors.ts';
import { GenerateProactiveSummarySchema } from './schema.ts';
import { generateProactiveSummary } from './service.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      throw new AppError({ code: 'METHOD_NOT_ALLOWED', message: 'Only POST is allowed', statusCode: 405 });
    }

    const user = await authenticateRequest(req);
    requireRole(user, ['professional']);
    logAuthEvent('proactive_summary.attempt', user, 'generate-proactive-summary');

    const body = await req.json();
    const parsed = GenerateProactiveSummarySchema.safeParse(body);

    if (!parsed.success) {
      throw new AppError({
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        statusCode: 400,
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const result = await generateProactiveSummary(parsed.data, user);
    return successResponse(result, req);
  } catch (error) {
    return errorResponse(error, req);
  }
});
