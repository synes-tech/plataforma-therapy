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

    let clinicId = user.clinic_id;

    if (!clinicId) {
      const { data: adminRecord } = await supabase
        .from('clinic_admins')
        .select('clinic_id, name')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .single();

      if (!adminRecord) {
        throw new AppError({
          code: 'NO_CLINIC',
          message: 'Usuário não vinculado a uma clínica',
          statusCode: 400,
        });
      }
      clinicId = adminRecord.clinic_id;
    }

    const { data: admin } = await supabase
      .from('clinic_admins')
      .select('name')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();

    const { data: clinic } = await supabase
      .from('clinics')
      .select('name, subscription_plan')
      .eq('id', clinicId)
      .is('deleted_at', null)
      .single();

    if (!clinic) {
      throw new AppError({ code: 'NOT_FOUND', message: 'Clínica não encontrada', statusCode: 404 });
    }

    const { data: settings } = await supabase
      .from('clinic_settings')
      .select('max_professionals')
      .eq('clinic_id', clinicId)
      .single();

    const { count: professionalsCount } = await supabase
      .from('professionals')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .is('deleted_at', null);

    const { count: patientsCount } = await supabase
      .from('patients')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .eq('status_vinculo', 'ativo')
      .is('deleted_at', null);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { data: patients } = await supabase
      .from('patients')
      .select('id')
      .eq('clinic_id', clinicId)
      .is('deleted_at', null);

    const patientIds = (patients ?? []).map((p) => p.id);

    let aiReportsCount = 0;
    if (patientIds.length > 0) {
      const { count } = await supabase
        .from('session_notes')
        .select('id', { count: 'exact', head: true })
        .in('patient_id', patientIds)
        .gte('created_at', monthStart.toISOString())
        .is('deleted_at', null);
      aiReportsCount = count ?? 0;
    }

    const { data: recentProfessionals } = await supabase
      .from('professionals')
      .select('id, name, specialty, status, created_at')
      .eq('clinic_id', clinicId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(5);

    return successResponse({
      admin_name: admin?.name ?? user.email.split('@')[0],
      clinic_name: clinic.name,
      subscription_plan: clinic.subscription_plan,
      professionals_count: professionalsCount ?? 0,
      max_professionals: settings?.max_professionals ?? 10,
      patients_count: patientsCount ?? 0,
      ai_reports_this_month: aiReportsCount,
      recent_professionals: recentProfessionals ?? [],
    }, req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
