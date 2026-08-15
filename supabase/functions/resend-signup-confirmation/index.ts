import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { AppError, ValidationError } from '../_shared/errors.ts';
import {
  buildSignupConfirmRedirect,
  sendIdpEmailVerification,
} from '../_shared/identity-platform-admin.ts';
import { assertEmailRateLimit, assertIpRateLimit } from '../_shared/rate-limit.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return errorResponse(new ValidationError({ method: 'Only POST is allowed' }), req);
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new ValidationError({ email: 'E-mail inválido' });
    }

    await assertIpRateLimit(req, { bucket: 'resend_confirm_ip', limit: 5, windowSec: 15 * 60 });
    await assertEmailRateLimit({
      bucket: 'resend_confirm_email',
      email,
      limit: 5,
      windowSec: 15 * 60,
    });

    const continueUrl = String(body.email_redirect_to ?? '').trim()
      || buildSignupConfirmRedirect(Deno.env.get('PUBLIC_APP_URL') ?? 'https://www.unithery.com');

    try {
      await sendIdpEmailVerification(email, continueUrl);
    } catch (err) {
      // Não vazar se o e-mail existe ou não — resposta genérica de sucesso
      console.warn(JSON.stringify({
        level: 'warn',
        action: 'resend_signup_confirmation_failed',
        message: err instanceof Error ? err.message : String(err),
      }));
    }

    return successResponse({
      message: 'Se existir uma conta pendente, um novo e-mail de confirmação foi enviado.',
    }, req);
  } catch (error) {
    if (error instanceof AppError || error instanceof ValidationError) {
      return errorResponse(error, req);
    }
    return errorResponse(error, req);
  }
});
