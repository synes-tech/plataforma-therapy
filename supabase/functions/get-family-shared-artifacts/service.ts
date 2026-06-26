import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import { assertFamilyOwnsPatient } from '../_shared/family-access.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import type {
  FamilySharedArtifactItem,
  GetFamilySharedArtifactsPayload,
  GetFamilySharedArtifactsResponse,
} from './types.ts';

const VALID_TYPES = new Set(['acao_recomendada', 'resumo_proativo', 'relatorio_sessao']);

export async function getFamilySharedArtifacts(
  payload: GetFamilySharedArtifactsPayload,
  caller: AuthenticatedUser,
): Promise<GetFamilySharedArtifactsResponse> {
  const link = await assertFamilyOwnsPatient(caller.id, payload.patient_id);
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('recomendacoes_salvas')
    .select('id, tipo_artefato, conteudo_texto, criado_em')
    .eq('paciente_id', link.patient_id)
    .eq('compartilhado_familia', true)
    .not('tipo_artefato', 'is', null)
    .not('conteudo_texto', 'is', null)
    .order('criado_em', { ascending: false });

  if (error) {
    throw new AppError({
      code: 'GET_FAMILY_ARTIFACTS_FAILED',
      message: error.message,
      statusCode: 500,
    });
  }

  const items: FamilySharedArtifactItem[] = [];

  for (const row of data ?? []) {
    const tipo = row.tipo_artefato as string;
    const text = row.conteudo_texto?.trim();
    if (!text || !VALID_TYPES.has(tipo)) continue;

    items.push({
      id: row.id,
      tipo_artefato: tipo as FamilySharedArtifactItem['tipo_artefato'],
      conteudo_texto: text,
      criado_em: row.criado_em,
    });
  }

  return {
    patient_id: link.patient_id,
    patient_name: link.patient_name,
    items,
  };
}
