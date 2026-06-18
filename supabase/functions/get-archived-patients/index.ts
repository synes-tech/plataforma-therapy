import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole } from '../_shared/auth.ts';
import { getArchivedPatients } from './service.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const user = await authenticateRequest(req);
    requireRole(user, ['professional', 'clinic_admin', 'master']);

    const payload = await getArchivedPatients(user);
    return successResponse(payload, req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
