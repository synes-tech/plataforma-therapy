import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireClinicOwner, logAuthEvent } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { resolveClinicId, resolveOwnerName, resolveOwnerRecord } from '../_shared/clinic.ts';
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

    const { clinic: clinicPatch, preferences: prefsPatch, owner_profile: ownerPatch } = parsed.data;

    if (!clinicPatch && !prefsPatch && !ownerPatch) {
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
        const { data: clinicRow, error } = await supabase
          .from('clinics')
          .update(updates)
          .eq('id', clinicId)
          .is('deleted_at', null)
          .select('id')
          .maybeSingle();
        if (error) {
          throw new AppError({ code: 'UPDATE_FAILED', message: error.message, statusCode: 500 });
        }
        if (!clinicRow) {
          throw new AppError({
            code: 'UPDATE_FAILED',
            message: 'Não foi possível atualizar os dados do consultório.',
            statusCode: 500,
          });
        }
        changed.clinic = Object.keys(updates);
      }
    }

    // 2. Update owner profile (admin ou profissional solo)
    if (ownerPatch && Object.keys(ownerPatch).length > 0) {
      const updates: Record<string, unknown> = {};
      if (ownerPatch.name !== undefined) updates.name = ownerPatch.name;
      if (ownerPatch.specialty !== undefined) updates.specialty = ownerPatch.specialty || null;
      if (ownerPatch.crp !== undefined) updates.crp = ownerPatch.crp || null;

      if (Object.keys(updates).length > 0) {
        const ownerRef = await resolveOwnerRecord(supabase, user);
        if (!ownerRef) {
          throw new AppError({
            code: 'UPDATE_FAILED',
            message: 'Não foi possível localizar o perfil para atualizar.',
            statusCode: 404,
          });
        }

        const table = ownerRef.kind === 'clinic_admin' ? 'clinic_admins' : 'professionals';
        const tableUpdates: Record<string, unknown> = { ...updates };
        if (table === 'clinic_admins') {
          delete tableUpdates.specialty;
          delete tableUpdates.crp;
        }

        if (Object.keys(tableUpdates).length === 0) {
          // apenas specialty/crp para admin — ignorar silenciosamente
        } else {
        const { data: ownerRow, error } = await supabase
          .from(table)
          .update(tableUpdates)
          .eq('id', ownerRef.id)
          .is('deleted_at', null)
          .select('id')
          .maybeSingle();

        if (error) {
          throw new AppError({ code: 'UPDATE_FAILED', message: error.message, statusCode: 500 });
        }
        if (!ownerRow) {
          throw new AppError({
            code: 'UPDATE_FAILED',
            message: 'Não foi possível atualizar o perfil. Recarregue a página e tente de novo.',
            statusCode: 500,
          });
        }
        changed.owner_profile = Object.keys(tableUpdates);
        }
      }
    }

    // 3. Update notification preferences (upsert)
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

    const ownerName = await resolveOwnerName(supabase, user);
    const ownerRefFresh = await resolveOwnerRecord(supabase, user);

    const { data: clinicFresh } = await supabase
      .from('clinics')
      .select('id, name, document, email, phone, subscription_plan, status, is_solo_professional, created_at')
      .eq('id', clinicId)
      .is('deleted_at', null)
      .single();

    let ownerFresh: Record<string, unknown>;
    if (ownerRefFresh?.kind === 'clinic_admin') {
      const { data: adminFresh } = await supabase
        .from('clinic_admins')
        .select('name, email, foto_url')
        .eq('id', ownerRefFresh.id)
        .is('deleted_at', null)
        .maybeSingle();
      ownerFresh = {
        kind: 'clinic_admin',
        name: adminFresh?.name ?? ownerName,
        email: adminFresh?.email ?? user.email,
        foto_url: adminFresh?.foto_url ?? null,
        specialty: null,
        crp: null,
      };
    } else if (ownerRefFresh?.kind === 'professional') {
      const { data: profFresh } = await supabase
        .from('professionals')
        .select('name, email, specialty, crp, foto_url')
        .eq('id', ownerRefFresh.id)
        .is('deleted_at', null)
        .maybeSingle();
      ownerFresh = {
        kind: 'professional',
        name: profFresh?.name ?? ownerName,
        email: profFresh?.email ?? user.email,
        specialty: profFresh?.specialty ?? null,
        crp: profFresh?.crp ?? null,
        foto_url: profFresh?.foto_url ?? null,
      };
    } else {
      ownerFresh = {
        kind: 'professional',
        name: ownerName,
        email: user.email,
        specialty: null,
        crp: null,
        foto_url: null,
      };
    }

    const { data: prefsFresh } = await supabase
      .from('clinic_preferences')
      .select('crisis_alerts_email, weekly_digest_email, ai_usage_alerts')
      .eq('clinic_id', clinicId)
      .maybeSingle();

    return successResponse({
      updated: true,
      changed,
      admin_name: ownerName,
      clinic: clinicFresh,
      owner_profile: ownerFresh,
      preferences: prefsFresh,
    }, req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
