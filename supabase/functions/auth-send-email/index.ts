import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { handleAuthSendEmailHook } from './service.ts';

/**
 * auth-send-email — Send Email Hook do Supabase Auth via Amazon SES.
 * Configurar em: Dashboard → Authentication → Hooks → Send Email (HTTPS).
 * verify_jwt = false (Supabase assina com webhook secret, não JWT).
 */
serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  return handleAuthSendEmailHook(req);
});
