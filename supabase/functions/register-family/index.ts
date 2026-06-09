import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { ValidationError } from '../_shared/errors.ts';
import { RegisterFamilySchema } from './schema.ts';
import { registerFamily } from './service.ts';

/**
 * register-family — cadastro público do responsável (sem confirmação de e-mail).
 * Cria auth user (email_confirm: true), consome o convite e promove role=family.
 */
serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return errorResponse(new ValidationError({ method: 'Only POST is allowed' }), req);
    }

    const body = await req.json();
    const parseResult = RegisterFamilySchema.safeParse(body);

    if (!parseResult.success) {
      return errorResponse(new ValidationError(parseResult.error.flatten().fieldErrors), req);
    }

    const result = await registerFamily(parseResult.data);
    return successResponse(result, req, 201);
  } catch (error) {
    return errorResponse(error, req);
  }
});
