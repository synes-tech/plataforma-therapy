import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { ValidationError } from '../_shared/errors.ts';
import { PreviewInviteSchema } from './schema.ts';
import { previewInvite } from './service.ts';

/**
 * preview-invite — endpoint público (sem auth) para pré-visualizar o paciente
 * vinculado a um código antes da confirmação final do onboarding familiar.
 */
serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return errorResponse(new ValidationError({ method: 'Only POST is allowed' }), req);
    }

    const body = await req.json();
    const parseResult = PreviewInviteSchema.safeParse(body);

    if (!parseResult.success) {
      return errorResponse(new ValidationError(parseResult.error.flatten().fieldErrors), req);
    }

    const result = await previewInvite(parseResult.data);
    return successResponse(result, req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
