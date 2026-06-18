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
    requireRole(user, ['professional', 'clinic_admin', 'master']);

    const supabase = createServiceClient();

    // Get professional record to find their patients
    const { data: professional } = await supabase
      .from('professionals')
      .select('id, clinic_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (!professional) {
      // Maybe it's a clinic_admin — list all patients of the clinic
      const { data: adminRecord } = await supabase
        .from('clinic_admins')
        .select('clinic_id')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .single();

      if (!adminRecord) {
        throw new AppError({ code: 'NO_ACCESS', message: 'Sem acesso a pacientes', statusCode: 403 });
      }

      const { data: patients, error } = await supabase
        .from('patients')
        .select('id, name, birth_date, diagnoses, status, status_vinculo, created_at, foto_url')
        .eq('clinic_id', adminRecord.clinic_id)
        .eq('status_vinculo', 'ativo')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw new AppError({ code: 'FETCH_FAILED', message: error.message, statusCode: 500 });
      return successResponse(patients ?? [], req, 200);
    }

    // Professional: list only their patients
    const { data: patients, error } = await supabase
      .from('patients')
      .select('id, name, birth_date, diagnoses, status, status_vinculo, created_at, foto_url')
      .eq('professional_id', professional.id)
      .eq('status_vinculo', 'ativo')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      throw new AppError({ code: 'FETCH_FAILED', message: error.message, statusCode: 500 });
    }

    return successResponse(patients ?? [], req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
