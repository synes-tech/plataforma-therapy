import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import { verifyPatientAccess } from '../_shared/verify-patient-access.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import { mapArtifactRow } from './map-artifact.ts';
import type {
  GetPatientArtifactsPayload,
  GetPatientArtifactsResponse,
  PatientArtifactItem,
} from './types.ts';

export async function getPatientArtifacts(
  payload: GetPatientArtifactsPayload,
  caller: AuthenticatedUser,
): Promise<GetPatientArtifactsResponse> {
  const supabase = createServiceClient();
  const ctx = await verifyPatientAccess(payload.patient_id, caller);

  let query = supabase
    .from('recomendacoes_salvas')
    .select('id, tipo_artefato, conteudo_texto, conteudo, criado_em')
    .eq('paciente_id', ctx.patient_id)
    .order('criado_em', { ascending: false });

  if (caller.role === 'professional') {
    query = query.eq('terapeuta_id', ctx.professional_id);
  }

  const filtro = payload.filtro_tipo ?? 'todos';

  if (filtro === 'acao_recomendada') {
    query = query.or('tipo_artefato.eq.acao_recomendada,tipo_artefato.is.null');
  } else if (filtro !== 'todos') {
    query = query.eq('tipo_artefato', filtro);
  }

  const { data, error } = await query;

  if (error) {
    throw new AppError({
      code: 'GET_ARTIFACTS_FAILED',
      message: error.message,
      statusCode: 500,
    });
  }

  const items: PatientArtifactItem[] = [];

  for (const row of data ?? []) {
    const mapped = mapArtifactRow(row);
    if (!mapped.item) continue;
    items.push(mapped.item);
  }

  return { items };
}
