import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole, logAuthEvent } from '../_shared/auth.ts';
import { ValidationError } from '../_shared/errors.ts';
import { GetPatientArtifactsSchema } from './schema.ts';
import { getPatientArtifacts } from './service.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return errorResponse(new ValidationError({ method: 'Only POST is allowed' }), req);
    }

    const user = await authenticateRequest(req);
    requireRole(user, ['professional', 'clinic_admin', 'master']);
    logAuthEvent('get_patient_artifacts.attempt', user, 'get-patient-artifacts');

    const body = await req.json();
    const parseResult = GetPatientArtifactsSchema.safeParse(body);

    if (!parseResult.success) {
      return errorResponse(new ValidationError(parseResult.error.flatten().fieldErrors), req);
    }

    const result = await getPatientArtifacts(parseResult.data, user);
    return successResponse(result, req);
  } catch (error) {
    return errorResponse(error, req);
  }
});
