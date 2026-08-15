import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { ValidationError } from '../_shared/errors.ts';
import { assertEmailRateLimit, assertIpRateLimit } from '../_shared/rate-limit.ts';

const ACTIONS = {
  login: { limit: 8, windowSec: 15 * 60 },
  password_reset: { limit: 5, windowSec: 15 * 60 },
} as const;

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return errorResponse(new ValidationError({ method: 'Only POST is allowed' }), req);
    }

    const body = await req.json().catch(() => ({}));
    const actionRaw = String(body.action ?? 'login').trim();
    const email = String(body.email ?? '').trim().toLowerCase();
    if (actionRaw !== 'login' && actionRaw !== 'password_reset') {
      throw new ValidationError({ action: 'Ação inválida' });
    }
    if (!email || !email.includes('@')) {
      throw new ValidationError({ email: 'E-mail inválido' });
    }

    const action = actionRaw as keyof typeof ACTIONS;
    const cfg = ACTIONS[action];

    await assertIpRateLimit(req, { bucket: `${action}_ip`, limit: cfg.limit, windowSec: cfg.windowSec });
    await assertEmailRateLimit({
      bucket: `${action}_email`,
      email,
      limit: cfg.limit,
      windowSec: cfg.windowSec,
    });

    return successResponse({ allowed: true }, req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
