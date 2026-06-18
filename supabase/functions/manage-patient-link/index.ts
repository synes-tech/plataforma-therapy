import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole, logAuthEvent } from '../_shared/auth.ts';
import { ValidationError } from '../_shared/errors.ts';
import { ManagePatientLinkSchema } from './schema.ts';
import { managePatientLink } from './service.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return errorResponse(new ValidationError({ method: 'Only POST is allowed' }), req);
    }

    const user = await authenticateRequest(req);
    requireRole(user, ['professional']);
    logAuthEvent('manage_patient_link.attempt', user, 'manage-patient-link');

    const body = await req.json();
    const parseResult = ManagePatientLinkSchema.safeParse(body);

    if (!parseResult.success) {
      return errorResponse(new ValidationError(parseResult.error.flatten().fieldErrors), req);
    }

    if (parseResult.data.acao === 'delete' && !parseResult.data.confirm_name?.trim()) {
      return errorResponse(
        new ValidationError({ confirm_name: 'Confirmação do nome é obrigatória para exclusão' }),
        req,
      );
    }

    const result = await managePatientLink(parseResult.data, user);
    return successResponse(result, req);
  } catch (error) {
    return errorResponse(error, req);
  }
});
