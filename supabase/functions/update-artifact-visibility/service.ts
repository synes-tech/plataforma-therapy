import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import { verifyProfessionalPatientWrite } from '../_shared/verify-patient-access.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type {
  UpdateArtifactVisibilityPayload,
  UpdateArtifactVisibilityResponse,
} from './types.ts';

export async function updateArtifactVisibility(
  payload: UpdateArtifactVisibilityPayload,
  caller: AuthenticatedUser,
): Promise<UpdateArtifactVisibilityResponse> {
  const supabase = createServiceClient();

  const { data: artifact, error: fetchError } = await supabase
    .from('recomendacoes_salvas')
    .select('id, paciente_id, terapeuta_id, clinica_id, conteudo, tipo_artefato')
    .eq('id', payload.artifact_id)
    .maybeSingle();

  if (fetchError) {
    throw new AppError({
      code: 'FETCH_ARTIFACT_FAILED',
      message: fetchError.message,
      statusCode: 500,
    });
  }

  if (!artifact) {
    throw new AppError({
      code: 'ARTIFACT_NOT_FOUND',
      message: 'Documento não encontrado',
      statusCode: 404,
    });
  }

  const ctx = await verifyProfessionalPatientWrite(artifact.paciente_id, caller);

  if (ctx.caller_professional_id !== artifact.terapeuta_id) {
    throw new AppError({
      code: 'FORBIDDEN',
      message: 'Você não pode alterar a visibilidade deste documento',
      statusCode: 403,
    });
  }

  const sharedWithFamily = payload.compartilhado_familia === true;
  const conteudo =
    artifact.conteudo && typeof artifact.conteudo === 'object' && !Array.isArray(artifact.conteudo)
      ? { ...(artifact.conteudo as Record<string, unknown>), shared_with_family: sharedWithFamily }
      : { shared_with_family: sharedWithFamily };

  const { data, error } = await supabase
    .from('recomendacoes_salvas')
    .update({
      compartilhado_familia: sharedWithFamily,
      conteudo,
    })
    .eq('id', artifact.id)
    .select('id, compartilhado_familia')
    .single();

  if (error || !data) {
    throw new AppError({
      code: 'UPDATE_VISIBILITY_FAILED',
      message: error?.message ?? 'Falha ao atualizar visibilidade',
      statusCode: 500,
    });
  }

  await supabase.from('audit_logs').insert({
    user_id: caller.id,
    clinic_id: ctx.clinic_id,
    action: 'ai.artifact_visibility_changed',
    resource_type: 'saved_recommendation',
    resource_id: data.id,
    metadata: {
      patient_id: ctx.patient_id,
      compartilhado_familia: sharedWithFamily,
      tipo_artefato: artifact.tipo_artefato,
    },
  });

  return {
    id: data.id,
    compartilhado_familia: data.compartilhado_familia === true,
    message: sharedWithFamily
      ? 'Documento agora está visível para a família'
      : 'Documento agora é apenas de uso interno',
  };
}
