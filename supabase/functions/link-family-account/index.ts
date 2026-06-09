import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, logAuthEvent } from '../_shared/auth.ts';
import { AppError, ValidationError } from '../_shared/errors.ts';
import { createServiceClient } from '../_shared/supabase.ts';

/**
 * link-family-account
 *
 * Handshake família↔clínica. O pai/mãe já criou a conta (Supabase Auth) e
 * agora informa o código de convite. Vincula auth.uid() ao patient_id via
 * consume_invite (transacional) e promove o usuário a role='family'.
 */

serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return errorResponse(new ValidationError({ method: 'Only POST is allowed' }), req);
    }

    const user = await authenticateRequest(req);
    logAuthEvent('link_family.attempt', user, 'link-family-account');

    const body = await req.json().catch(() => ({}));
    const code = String(body.invite_code ?? body.code ?? '').trim();
    const name = String(body.name ?? '').trim() || (user.email?.split('@')[0] ?? 'Responsável');
    const phone = body.phone ? String(body.phone) : null;

    if (code.length < 6) {
      throw new ValidationError({ invite_code: 'Código de convite inválido.' });
    }

    const supabase = createServiceClient();

    const { data, error } = await supabase.rpc('consume_invite', {
      p_code: code,
      p_user_id: user.id,
      p_name: name,
      p_email: user.email,
      p_phone: phone,
    });

    if (error) {
      const msg = error.message;
      if (msg.includes('INVITE_NOT_FOUND')) throw new AppError({ code: 'INVITE_NOT_FOUND', message: 'Código de convite inválido', statusCode: 404 });
      if (msg.includes('INVITE_CONSUMED')) throw new AppError({ code: 'INVITE_CONSUMED', message: 'Este convite já foi utilizado', statusCode: 409 });
      if (msg.includes('INVITE_EXPIRED')) throw new AppError({ code: 'INVITE_EXPIRED', message: 'Este convite expirou. Solicite um novo ao terapeuta.', statusCode: 410 });
      if (msg.includes('INVITE_REVOKED')) throw new AppError({ code: 'INVITE_REVOKED', message: 'Este convite foi revogado', statusCode: 410 });
      if (msg.includes('ALREADY_LINKED')) throw new AppError({ code: 'ALREADY_LINKED', message: 'Você já está vinculado a este paciente.', statusCode: 409 });
      if (msg.includes('FAMILY_QUOTA_EXCEEDED')) throw new AppError({ code: 'FAMILY_QUOTA_EXCEEDED', message: 'Limite de familiares para este paciente atingido', statusCode: 429 });
      throw new AppError({ code: 'LINK_FAILED', message: error.message, statusCode: 500 });
    }

    const result = data as { family_member_id: string; patient_id: string; clinic_id: string; relationship: string };

    // Promove o usuário a família (role + clinic no JWT)
    await supabase.auth.admin.updateUserById(user.id, {
      app_metadata: { role: 'family', clinic_id: result.clinic_id },
    });

    await supabase.from('audit_logs').insert({
      user_id: user.id,
      clinic_id: result.clinic_id,
      action: 'invite.consumed',
      resource_type: 'invite',
      resource_id: null,
      metadata: { patient_id: result.patient_id },
    });

    return successResponse(
      { patient_id: result.patient_id, clinic_id: result.clinic_id, relationship: result.relationship, message: 'Vinculação realizada com sucesso' },
      req,
      200,
    );
  } catch (error) {
    return errorResponse(error, req);
  }
});
