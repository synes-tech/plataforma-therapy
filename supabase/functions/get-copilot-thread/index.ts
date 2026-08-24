import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole, logAuthEvent } from '../_shared/auth.ts';
import { ValidationError } from '../_shared/errors.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import {
  getOrCreateActiveThread,
  listThreadMessages,
  resolveOwnedPatient,
} from '../_shared/copilot-thread.ts';
import { GetCopilotThreadSchema } from './schema.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return errorResponse(new ValidationError({ method: 'Only POST is allowed' }), req);
    }

    const user = await authenticateRequest(req);
    requireRole(user, ['professional']);
    logAuthEvent('copilot_thread.read', user, 'get-copilot-thread');

    const body = await req.json();
    const parsed = GetCopilotThreadSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(new ValidationError(parsed.error.flatten().fieldErrors), req);
    }

    const supabase = createServiceClient();
    const access = await resolveOwnedPatient(supabase, user, parsed.data.patient_id);
    const thread = await getOrCreateActiveThread(supabase, access, user.id);
    const messages = await listThreadMessages(supabase, thread.id);

    return successResponse({
      thread_id: thread.id,
      patient_id: access.patientId,
      patient_name: access.patientName,
      messages,
    }, req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
