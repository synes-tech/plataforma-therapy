import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import { verifyPatientAccess } from '../_shared/verify-patient-access.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type {
  ListSavedRecommendationsPayload,
  ListSavedRecommendationsResponse,
  SavedRecommendationItem,
} from './types.ts';

export async function listSavedRecommendations(
  payload: ListSavedRecommendationsPayload,
  caller: AuthenticatedUser,
): Promise<ListSavedRecommendationsResponse> {
  const supabase = createServiceClient();
  await verifyPatientAccess(payload.patient_id, caller);

  const { data, error } = await supabase
    .from('recomendacoes_salvas')
    .select('id, paciente_id, terapeuta_id, conteudo, criado_em')
    .eq('paciente_id', payload.patient_id)
    .order('criado_em', { ascending: false });

  if (error) {
    throw new AppError({
      code: 'LIST_RECOMMENDATIONS_FAILED',
      message: error.message,
      statusCode: 500,
    });
  }

  return {
    items: (data ?? []) as SavedRecommendationItem[],
  };
}
