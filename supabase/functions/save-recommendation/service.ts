import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import { verifyProfessionalPatientWrite } from '../_shared/verify-patient-access.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type { SaveRecommendationPayload, SaveRecommendationResponse } from './types.ts';

export async function saveRecommendation(
  payload: SaveRecommendationPayload,
  caller: AuthenticatedUser,
): Promise<SaveRecommendationResponse> {
  const supabase = createServiceClient();
  const ctx = await verifyProfessionalPatientWrite(payload.patient_id, caller);

  const { data, error } = await supabase
    .from('recomendacoes_salvas')
    .insert({
      paciente_id: ctx.patient_id,
      terapeuta_id: ctx.caller_professional_id,
      clinica_id: ctx.clinic_id,
      conteudo: payload.conteudo,
    })
    .select('id, criado_em')
    .single();

  if (error || !data) {
    throw new AppError({
      code: 'SAVE_RECOMMENDATION_FAILED',
      message: error?.message ?? 'Falha ao salvar recomendação',
      statusCode: 500,
    });
  }

  await supabase.from('audit_logs').insert({
    user_id: caller.id,
    clinic_id: ctx.clinic_id,
    action: 'recommendation.save',
    resource_type: 'saved_recommendation',
    resource_id: data.id,
    metadata: { patient_id: ctx.patient_id },
  });

  return {
    id: data.id,
    criado_em: data.criado_em,
    message: 'Recomendação salva com sucesso',
  };
}
