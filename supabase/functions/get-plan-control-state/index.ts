import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireClinicOwner } from '../_shared/auth.ts';
import { getPlanControlState } from './service.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const user = await authenticateRequest(req);
    requireClinicOwner(user);

    const state = await getPlanControlState(user);
    return successResponse(state, req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
