import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { ValidationError } from '../_shared/errors.ts';
import { RegisterClinicSchema } from './schema.ts';
import { registerClinic } from './service.ts';

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return errorResponse(
        new ValidationError({ method: 'Only POST is allowed' }),
        req,
      );
    }

    // Parse and validate input
    const body = await req.json();
    const parseResult = RegisterClinicSchema.safeParse(body);

    if (!parseResult.success) {
      return errorResponse(
        new ValidationError(parseResult.error.flatten().fieldErrors),
        req,
      );
    }

    // Execute business logic
    const result = await registerClinic(parseResult.data);

    return successResponse(result, req, 201);
  } catch (error) {
    return errorResponse(error, req);
  }
});
