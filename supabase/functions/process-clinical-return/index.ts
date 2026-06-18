import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { ValidationError } from '../_shared/errors.ts';
import { ProcessClinicalReturnSchema } from './schema.ts';
import { processClinicalReturn } from './service.ts';

/**
 * process-clinical-return — Async AI Pipeline (Clean Transcription)
 *
 * Triggered by the job queue when a 'clinical_return' recording is uploaded.
 * Unlike process-audio (which generates SOAP + embeddings), this function:
 * 1. Transcribes the audio via Gemini
 * 2. Cleans filler words and formats into professional clinical language
 * 3. Saves the clean transcription to audio_transcriptions
 *
 * Does NOT generate SOAP notes or embeddings — the result is free-form text
 * that lives in the patient's record as clinical observations.
 *
 * The frontend is notified via Supabase Realtime (ai_jobs table update).
 */
serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return errorResponse(new ValidationError({ method: 'Only POST is allowed' }), req);
    }

    // NOTE: Invoked internally by service role (webhook/cron), not user-facing.
    const body = await req.json();
    const parseResult = ProcessClinicalReturnSchema.safeParse(body);

    if (!parseResult.success) {
      return errorResponse(new ValidationError(parseResult.error.flatten().fieldErrors), req);
    }

    const result = await processClinicalReturn(parseResult.data);

    return successResponse(result, req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
