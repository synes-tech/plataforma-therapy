import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { ValidationError } from '../_shared/errors.ts';
import { assertCronAuth, processSessionEmailQueue } from './service.ts';

/**
 * process-session-email-queue — Cron (pg_cron + pg_net)
 * Processa jobs pendentes de e-mail de sessão (lembrete 24h / manual agendado).
 * Auth: header X-Cron-Secret
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
    const limit = Math.min(Math.max(Number(body.limit ?? 50) || 50, 1), 100);
    const result = await processSessionEmailQueue(limit);
    return successResponse(result, req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
