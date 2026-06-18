import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ForbiddenError } from '../_shared/errors.ts';
import { verifyProfessionalPatientWrite } from '../_shared/verify-patient-access.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type {
  DeleteSavedRecommendationPayload,
  DeleteSavedRecommendationResponse,
} from './types.ts';

export async function deleteSavedRecommendation(
  payload: DeleteSavedRecommendationPayload,
  caller: AuthenticatedUser,
): Promise<DeleteSavedRecommendationResponse> {
  const supabase = createServiceClient();
  const ctx = await verifyProfessionalPatientWrite(payload.patient_id, caller);

  const { data: existing, error: fetchError } = await supabase
    .from('recomendacoes_salvas')
    .select('id, paciente_id, terapeuta_id, clinica_id')
    .eq('id', payload.recommendation_id)
    .eq('paciente_id', payload.patient_id)
    .maybeSingle();

  if (fetchError) {
    throw new AppError({
      code: 'DELETE_RECOMMENDATION_FETCH_FAILED',
      message: fetchError.message,
      statusCode: 500,
    });
  }

  if (!existing) {
    throw new AppError({
      code: 'RECOMMENDATION_NOT_FOUND',
      message: 'Recomendação não encontrada',
      statusCode: 404,
    });
  }

  if (caller.role === 'professional' && existing.terapeuta_id !== ctx.caller_professional_id) {
    throw new ForbiddenError('Você só pode remover recomendações da sua carteira');
  }

  const { error: deleteError } = await supabase
    .from('recomendacoes_salvas')
    .delete()
    .eq('id', payload.recommendation_id)
    .eq('paciente_id', payload.patient_id);

  if (deleteError) {
    throw new AppError({
      code: 'DELETE_RECOMMENDATION_FAILED',
      message: deleteError.message,
      statusCode: 500,
    });
  }

  await supabase.from('audit_logs').insert({
    user_id: caller.id,
    clinic_id: existing.clinica_id,
    action: 'recommendation.delete',
    resource_type: 'saved_recommendation',
    resource_id: existing.id,
    metadata: { patient_id: payload.patient_id },
  });

  return {
    id: existing.id,
    message: 'Recomendação removida com sucesso',
  };
}
