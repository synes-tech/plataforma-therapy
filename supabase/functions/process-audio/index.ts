import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { ValidationError } from '../_shared/errors.ts';
import { ProcessAudioSchema } from './schema.ts';
import { processAudio } from './service.ts';

/**
 * process-audio — Async AI Pipeline
 *
 * This function is triggered by the job queue (not directly by user).
 * It processes an audio recording through:
 * 1. Whisper STT → raw transcription
 * 2. LLM → SOAP structured note (draft)
 * 3. Embeddings → pgvector for RAG copilot
 *
 * The frontend is notified via Supabase Realtime when complete.
 */
serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return errorResponse(new ValidationError({ method: 'Only POST is allowed' }), req);
    }

    // NOTE: This function is invoked by internal webhook/cron, not user directly.
    // Auth validation is relaxed (triggered by service role via DB webhook).
    const body = await req.json();
    const parseResult = ProcessAudioSchema.safeParse(body);

    if (!parseResult.success) {
      return errorResponse(new ValidationError(parseResult.error.flatten().fieldErrors), req);
    }

    const result = await processAudio(parseResult.data);

    return successResponse(result, req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
