import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';
import { successResponse, errorResponse } from '../_shared/response.ts';
import { authenticateRequest } from '../_shared/auth.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import { assertFinanceAccess } from '../_shared/financeiro.ts';

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  try {
    const user = await authenticateRequest(req);
    const clinicId = assertFinanceAccess(user);
    const body = await req.json();
    const id = String(body.id ?? '');
    if (!id) throw new AppError({ code: 'VALIDATION_ERROR', message: 'id obrigatório', statusCode: 400 });

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('financeiro_transacoes')
      .update({ status: 'CANCELADO', deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .select('id, status')
      .single();
    if (error || !data) {
      throw new AppError({ code: 'NOT_FOUND', message: 'Transação não encontrada', statusCode: 404 });
    }
    return successResponse({ item: data }, req);
  } catch (error) {
    return errorResponse(error, req);
  }
});
