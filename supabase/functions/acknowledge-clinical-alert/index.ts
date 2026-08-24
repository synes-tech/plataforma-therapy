import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole, logAuthEvent } from '../_shared/auth.ts';
import { ValidationError } from '../_shared/errors.ts';
import { AcknowledgeClinicalAlertSchema } from './schema.ts';
import { acknowledgeClinicalAlert } from './service.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST' && req.method !== 'PATCH') {
      return errorResponse(new ValidationError({ method: 'Only POST or PATCH is allowed' }), req);
    }

    const user = await authenticateRequest(req);
    requireRole(user, ['professional', 'clinic_admin', 'master']);
    logAuthEvent('clinical_alerts.acknowledge', user, 'acknowledge-clinical-alert');

    const body = await req.json();
    const parsed = AcknowledgeClinicalAlertSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(new ValidationError(parsed.error.flatten().fieldErrors), req);
    }

    const response = await acknowledgeClinicalAlert(user, parsed.data);
    return successResponse(response, req);
  } catch (error) {
    return errorResponse(error, req);
  }
});
