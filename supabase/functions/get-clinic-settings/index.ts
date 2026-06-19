import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireClinicOwner } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { resolveClinicId, resolveOwnerName, getMonthlyAiUsage } from '../_shared/clinic.ts';
import { AppError } from '../_shared/errors.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const user = await authenticateRequest(req);
    requireClinicOwner(user);

    const supabase = createServiceClient();
    const clinicId = await resolveClinicId(supabase, user);

    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('id, name, document, email, phone, subscription_plan, status, is_solo_professional, created_at')
      .eq('id', clinicId)
      .is('deleted_at', null)
      .single();

    if (clinicError || !clinic) {
      throw new AppError({ code: 'NOT_FOUND', message: 'Clínica não encontrada', statusCode: 404 });
    }

    const { data: settings } = await supabase
      .from('clinic_settings')
      .select('max_professionals, max_patients_per_professional, max_family_members_per_patient, max_ai_queries_per_month, max_audio_minutes_per_month')
      .eq('clinic_id', clinicId)
      .single();

    // Ensure preferences row exists (idempotent)
    let { data: preferences } = await supabase
      .from('clinic_preferences')
      .select('crisis_alerts_email, weekly_digest_email, ai_usage_alerts')
      .eq('clinic_id', clinicId)
      .maybeSingle();

    if (!preferences) {
      const { data: inserted } = await supabase
        .from('clinic_preferences')
        .insert({ clinic_id: clinicId })
        .select('crisis_alerts_email, weekly_digest_email, ai_usage_alerts')
        .single();
      preferences = inserted;
    }

    const ownerName = await resolveOwnerName(supabase, user);

    const { data: adminProfile } = await supabase
      .from('clinic_admins')
      .select('name, email, foto_url')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();

    let ownerProfile: Record<string, unknown>;

    if (adminProfile) {
      ownerProfile = {
        kind: 'clinic_admin',
        name: adminProfile.name,
        email: adminProfile.email,
        foto_url: adminProfile.foto_url ?? null,
        specialty: null,
        crp: null,
      };
    } else {
      const { data: profProfile } = await supabase
        .from('professionals')
        .select('name, email, specialty, crp, foto_url')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .maybeSingle();

      ownerProfile = {
        kind: 'professional',
        name: profProfile?.name ?? ownerName,
        email: profProfile?.email ?? user.email,
        specialty: profProfile?.specialty ?? null,
        crp: profProfile?.crp ?? null,
        foto_url: profProfile?.foto_url ?? null,
      };
    }

    // IA metering — uso do mês vs cota
    const usage = await getMonthlyAiUsage(supabase, clinicId);

    const [
      { count: professionalsCount },
      { count: clinicActivePatients },
      { data: ownerProfessional },
      { data: clinicBackup },
      { count: archivedPatients },
    ] = await Promise.all([
      supabase
        .from('professionals')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', clinicId)
        .is('deleted_at', null),
      supabase
        .from('patients')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', clinicId)
        .eq('status', 'active')
        .eq('status_vinculo', 'ativo')
        .is('deleted_at', null),
      supabase
        .from('professionals')
        .select('id')
        .eq('clinic_id', clinicId)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .maybeSingle(),
      supabase
        .from('clinics')
        .select('quantidade_backup_pacientes')
        .eq('id', clinicId)
        .is('deleted_at', null)
        .single(),
      supabase
        .from('patients')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', clinicId)
        .eq('status_vinculo', 'desvinculado')
        .is('deleted_at', null),
    ]);

    let ownerActivePatients = 0;
    if (ownerProfessional?.id) {
      const { count } = await supabase
        .from('patients')
        .select('id', { count: 'exact', head: true })
        .eq('professional_id', ownerProfessional.id)
        .eq('status', 'active')
        .eq('status_vinculo', 'ativo')
        .is('deleted_at', null);
      ownerActivePatients = count ?? 0;
    }

    return successResponse({
      admin_name: ownerName,
      owner_profile: ownerProfile,
      clinic: {
        id: clinic.id,
        name: clinic.name,
        document: clinic.document,
        email: clinic.email,
        phone: clinic.phone,
        subscription_plan: clinic.subscription_plan,
        status: clinic.status,
        is_solo_professional: clinic.is_solo_professional,
        created_at: clinic.created_at,
      },
      quotas: {
        max_professionals: settings?.max_professionals ?? 0,
        max_patients_per_professional: settings?.max_patients_per_professional ?? 0,
        max_family_members_per_patient: settings?.max_family_members_per_patient ?? 0,
        max_ai_queries_per_month: settings?.max_ai_queries_per_month ?? 0,
        max_audio_minutes_per_month: settings?.max_audio_minutes_per_month ?? 0,
      },
      ai_usage: {
        ai_reports_this_month: usage.ai_reports,
        audio_minutes_this_month: usage.audio_minutes,
      },
      resource_usage: {
        professionals_count: professionalsCount ?? 0,
        active_patients_clinic_total: clinicActivePatients ?? 0,
        active_patients_owner_count: ownerActivePatients,
        owner_is_professional: Boolean(ownerProfessional?.id),
        backup_licenses: Number(clinicBackup?.quantidade_backup_pacientes ?? 0),
        backup_archived_count: archivedPatients ?? 0,
      },
      preferences: preferences ?? {
        crisis_alerts_email: true,
        weekly_digest_email: true,
        ai_usage_alerts: true,
      },
    }, req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
