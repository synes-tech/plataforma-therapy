import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ValidationError } from '../_shared/errors.ts';

const UpdateSchema = z.object({
  professional_id: z.string().uuid(),
  name: z.string().min(2).max(100).optional(),
  specialty: z.string().max(100).optional(),
  crp: z.string().max(30).optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
});

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return errorResponse(new ValidationError({ method: 'Only POST is allowed' }), req);
    }

    const user = await authenticateRequest(req);
    requireRole(user, ['clinic_admin', 'master']);

    const body = await req.json();
    const parseResult = UpdateSchema.safeParse(body);

    if (!parseResult.success) {
      return errorResponse(new ValidationError(parseResult.error.flatten().fieldErrors), req);
    }

    const { professional_id, ...updates } = parseResult.data;
    const supabase = createServiceClient();

    // Get clinic_id from admin record
    let clinicId = user.clinic_id;
    if (!clinicId) {
      const { data: adminRecord } = await supabase
        .from('clinic_admins')
        .select('clinic_id')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .single();
      clinicId = adminRecord?.clinic_id ?? null;
    }

    if (!clinicId) {
      throw new AppError({ code: 'NO_CLINIC', message: 'Usuário não vinculado a uma clínica', statusCode: 400 });
    }

    // Verify professional belongs to this clinic
    const { data: prof } = await supabase
      .from('professionals')
      .select('id')
      .eq('id', professional_id)
      .eq('clinic_id', clinicId)
      .is('deleted_at', null)
      .single();

    if (!prof) {
      throw new AppError({ code: 'NOT_FOUND', message: 'Profissional não encontrado nesta clínica', statusCode: 404 });
    }

    // Update
    const updateData: Record<string, unknown> = {};
    if (updates.name) updateData.name = updates.name;
    if (updates.specialty !== undefined) updateData.specialty = updates.specialty;
    if (updates.crp !== undefined) updateData.crp = updates.crp;
    if (updates.status) updateData.status = updates.status;

    const { error } = await supabase
      .from('professionals')
      .update(updateData)
      .eq('id', professional_id);

    if (error) {
      throw new AppError({ code: 'UPDATE_FAILED', message: error.message, statusCode: 500 });
    }

    // Audit
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      clinic_id: clinicId,
      action: 'professional.update',
      resource_type: 'professional',
      resource_id: professional_id,
      metadata: updateData,
    });

    return successResponse({ message: 'Profissional atualizado com sucesso' }, req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
