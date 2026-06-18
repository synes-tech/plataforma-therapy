import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { ValidationError } from '../_shared/errors.ts';
import { CheckRemindersSchema } from './schema.ts';
import { assertCronAuth, checkAndSendReminders } from './service.ts';

/**
 * check-and-send-reminders — Cron job (pg_cron + pg_net)
 * Varre famílias sem diário recente e dispara Web Push (VAPID).
 * Autenticação: header X-Cron-Secret (não expor JWT ao pg_cron).
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
    const parsed = CheckRemindersSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(new ValidationError(parsed.error.flatten().fieldErrors), req);
    }

    const result = await checkAndSendReminders(parsed.data);
    return successResponse(result, req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
