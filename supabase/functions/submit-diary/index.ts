import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole, logAuthEvent } from '../_shared/auth.ts';
import { ValidationError } from '../_shared/errors.ts';
import { extractToken } from '../_shared/supabase.ts';
import { SubmitDiarySchema } from './schema.ts';
import { submitDiary } from './service.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return errorResponse(new ValidationError({ method: 'Only POST is allowed' }), req);
    }

    const user = await authenticateRequest(req);
    requireRole(user, ['family']);
    logAuthEvent('submit_diary.attempt', user, 'submit-diary');

    const body = await req.json();
    const parseResult = SubmitDiarySchema.safeParse(body);

    if (!parseResult.success) {
      return errorResponse(new ValidationError(parseResult.error.flatten().fieldErrors), req);
    }

    const token = extractToken(req);
    const result = await submitDiary(parseResult.data, user, token);

    return successResponse(result, req, 201);
  } catch (error) {
    return errorResponse(error, req);
  }
});
