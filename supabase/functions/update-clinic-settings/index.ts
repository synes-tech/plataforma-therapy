import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireClinicOwner, logAuthEvent } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { resolveClinicId } from '../_shared/clinic.ts';
import { AppError, ValidationError } from '../_shared/errors.ts';
import { UpdateClinicSettingsSchema } from './schema.ts';

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const user = await authenticateRequest(req);
    // SEGURANÇA: somente dono da clínica (admin/master/solo). Quotas NÃO são editáveis aqui (controle do Master).
    requireClinicOwner(user);

    const body = await req.json().catch(() => ({}));
    const parsed = UpdateClinicSettingsSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors);
    }

    const { clinic: clinicPatch, preferences: prefsPatch } = parsed.data;

    if (!clinicPatch && !prefsPatch) {
      throw new AppError({ code: 'NO_CHANGES', message: 'Nenhuma alteração enviada', statusCode: 400 });
    }

    const supabase = createServiceClient();
    const clinicId = await resolveClinicId(supabase, user);

    const changed: Record<string, unknown> = {};

    // 1. Update clinic profile (apenas campos editáveis pelo admin)
    if (clinicPatch) {
      const updates: Record<string, unknown> = {};
      if (clinicPatch.name !== undefined) updates.name = clinicPatch.name;
      if (clinicPatch.email !== undefined) updates.email = clinicPatch.email;
      if (clinicPatch.phone !== undefined) updates.phone = clinicPatch.phone || null;
      if (clinicPatch.document !== undefined) updates.document = clinicPatch.document || null;

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from('clinics')
          .update(updates)
          .eq('id', clinicId)
          .is('deleted_at', null);
        if (error) {
          throw new AppError({ code: 'UPDATE_FAILED', message: error.message, statusCode: 500 });
        }
        changed.clinic = Object.keys(updates);
      }
    }

    // 2. Update notification preferences (upsert)
    if (prefsPatch && Object.keys(prefsPatch).length > 0) {
      const { error } = await supabase
        .from('clinic_preferences')
        .upsert({ clinic_id: clinicId, ...prefsPatch }, { onConflict: 'clinic_id' });
      if (error) {
        throw new AppError({ code: 'UPDATE_FAILED', message: error.message, statusCode: 500 });
      }
      changed.preferences = Object.keys(prefsPatch);
    }

    // 3. Audit log (imutável)
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      clinic_id: clinicId,
      action: 'clinic.settings.update',
      resource_type: 'clinic',
      resource_id: clinicId,
      ip_address: req.headers.get('x-forwarded-for'),
      user_agent: req.headers.get('user-agent'),
      metadata: { changed },
    });

    logAuthEvent('clinic.settings.update', user, 'update-clinic-settings', { changed });

    return successResponse({ updated: true, changed }, req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
