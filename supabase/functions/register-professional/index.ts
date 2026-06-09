import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole, logAuthEvent } from '../_shared/auth.ts';
import { ValidationError } from '../_shared/errors.ts';
import { RegisterProfessionalSchema } from './schema.ts';
import { registerProfessional } from './service.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return errorResponse(
        new ValidationError({ method: 'Only POST is allowed' }),
        req,
      );
    }

    // Authenticate and authorize: only clinic_admin or master can register professionals
    const user = await authenticateRequest(req);
    requireRole(user, ['clinic_admin', 'master']);

    logAuthEvent('register_professional.attempt', user, 'register-professional');

    // Parse and validate input
    const body = await req.json();
    const parseResult = RegisterProfessionalSchema.safeParse(body);

    if (!parseResult.success) {
      return errorResponse(
        new ValidationError(parseResult.error.flatten().fieldErrors),
        req,
      );
    }

    // Execute
    const result = await registerProfessional(parseResult.data, user);

    return successResponse(result, req, 201);
  } catch (error) {
    return errorResponse(error, req);
  }
});
