import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole, logAuthEvent } from '../_shared/auth.ts';
import { ValidationError } from '../_shared/errors.ts';
import { ProcessFamilyAudioSchema } from './schema.ts';
import { initiateFamilyAudio, completeFamilyAudio } from './service.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return errorResponse(new ValidationError({ method: 'Only POST is allowed' }), req);
    }

    const user = await authenticateRequest(req);
    requireRole(user, ['family']);
    logAuthEvent('process_family_audio.attempt', user, 'process-family-audio');

    const body = await req.json();
    const parseResult = ProcessFamilyAudioSchema.safeParse(body);

    if (!parseResult.success) {
      return errorResponse(new ValidationError(parseResult.error.flatten().fieldErrors), req);
    }

    const payload = parseResult.data;
    const result =
      payload.step === 'initiate'
        ? await initiateFamilyAudio(payload, user)
        : await completeFamilyAudio(payload, user);

    return successResponse(result, req, payload.step === 'initiate' ? 200 : 201);
  } catch (error) {
    return errorResponse(error, req);
  }
});
