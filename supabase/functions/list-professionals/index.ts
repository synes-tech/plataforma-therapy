import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const user = await authenticateRequest(req);
    requireRole(user, ['clinic_admin', 'master']);

    const supabase = createServiceClient();

    // Get the clinic_id from clinic_admins table
    let clinicId = user.clinic_id;

    if (!clinicId) {
      const { data: adminRecord } = await supabase
        .from('clinic_admins')
        .select('clinic_id')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .single();

      if (!adminRecord) {
        throw new AppError({ code: 'NO_CLINIC', message: 'Usuário não vinculado a uma clínica', statusCode: 400 });
      }
      clinicId = adminRecord.clinic_id;
    }

    // Fetch all professionals for this clinic
    const { data: professionals, error } = await supabase
      .from('professionals')
      .select('id, name, email, specialty, crp, status, created_at')
      .eq('clinic_id', clinicId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      throw new AppError({ code: 'FETCH_FAILED', message: error.message, statusCode: 500 });
    }

    return successResponse(professionals ?? [], req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
