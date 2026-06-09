import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest, requireRole } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ValidationError, ForbiddenError } from '../_shared/errors.ts';

/**
 * toggle-agreement — Família marca um Combinado como feito/pendente.
 * Isolamento: a família só altera agreements de paciente vinculado a ela.
 * Escopo de coluna: só status + completed_at (defesa contra escrita indevida).
 */
serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (req.method !== 'POST') {
      return errorResponse(new ValidationError({ method: 'Only POST is allowed' }), req);
    }

    const user = await authenticateRequest(req);
    requireRole(user, ['family']);

    const body = await req.json().catch(() => ({}));
    const agreementId = String(body.agreement_id ?? '');
    const done = Boolean(body.done);
    if (!agreementId) throw new ValidationError({ agreement_id: 'agreement_id é obrigatório.' });

    const supabase = createServiceClient();

    const { data: agreement } = await supabase
      .from('agreements')
      .select('id, patient_id')
      .eq('id', agreementId)
      .is('deleted_at', null)
      .single();

    if (!agreement) throw new AppError({ code: 'NOT_FOUND', message: 'Combinado não encontrado', statusCode: 404 });

    // Verifica vínculo família ↔ paciente
    const { data: link } = await supabase
      .from('patient_family_links')
      .select('id')
      .eq('user_id', user.id)
      .eq('patient_id', agreement.patient_id)
      .maybeSingle();

    if (!link) throw new ForbiddenError('Você não tem acesso a este combinado.');

    const { data: updated, error } = await supabase
      .from('agreements')
      .update({ status: done ? 'done' : 'pending', completed_at: done ? new Date().toISOString() : null })
      .eq('id', agreementId)
      .select('id, status, completed_at')
      .single();

    if (error) throw new AppError({ code: 'UPDATE_FAILED', message: error.message, statusCode: 500 });

    return successResponse(updated, req, 200);
  } catch (error) {
    return errorResponse(error, req);
  }
});
