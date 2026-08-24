import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole, logAuthEvent } from '../_shared/auth.ts';
import { ValidationError } from '../_shared/errors.ts';
import { ListClinicalAlertsSchema } from './schema.ts';
import { listClinicalAlerts } from './service.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return errorResponse(new ValidationError({ method: 'Only GET or POST is allowed' }), req);
    }

    const user = await authenticateRequest(req);
    requireRole(user, ['professional', 'clinic_admin', 'master']);
    logAuthEvent('clinical_alerts.list', user, 'list-clinical-alerts');

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const parsed = ListClinicalAlertsSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return errorResponse(new ValidationError(parsed.error.flatten().fieldErrors), req);
    }

    const response = await listClinicalAlerts(user, parsed.data);
    return successResponse(response, req);
  } catch (error) {
    return errorResponse(error, req);
  }
});
