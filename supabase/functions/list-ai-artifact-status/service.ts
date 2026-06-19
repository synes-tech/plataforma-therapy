import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import { verifyPatientAccess } from '../_shared/verify-patient-access.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type {
  ListAiArtifactStatusPayload,
  ListAiArtifactStatusResponse,
} from './types.ts';

export async function listAiArtifactStatus(
  payload: ListAiArtifactStatusPayload,
  caller: AuthenticatedUser,
): Promise<ListAiArtifactStatusResponse> {
  const supabase = createServiceClient();
  const ctx = await verifyPatientAccess(payload.patient_id, caller);

  let query = supabase
    .from('recomendacoes_salvas')
    .select('artifact_fingerprint, tipo_artefato')
    .eq('paciente_id', ctx.patient_id)
    .not('artifact_fingerprint', 'is', null)
    .not('tipo_artefato', 'is', null);

  if (caller.role === 'professional') {
    query = query.eq('terapeuta_id', ctx.professional_id);
  }

  const { data, error } = await query;

  if (error) {
    throw new AppError({
      code: 'LIST_ARTIFACT_STATUS_FAILED',
      message: error.message,
      statusCode: 500,
    });
  }

  return {
    saved: (data ?? []).map((row) => ({
      artifact_fingerprint: row.artifact_fingerprint as string,
      tipo_artefato: row.tipo_artefato as string,
    })),
  };
}
