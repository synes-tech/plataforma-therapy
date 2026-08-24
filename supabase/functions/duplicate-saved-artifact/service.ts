import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import { verifyProfessionalPatientWrite } from '../_shared/verify-patient-access.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import { artifactFingerprint } from '../save-ai-artifact/fingerprint.ts';
import { buildSessionReportCopyTitle } from '../_shared/session-artifact-title.ts';
import { resolveArtifactDisplayTitle } from '../_shared/artifact-display-title.ts';
import type {
  DuplicateSavedArtifactPayload,
  DuplicateSavedArtifactResponse,
} from './types.ts';

export async function duplicateSavedArtifact(
  payload: DuplicateSavedArtifactPayload,
  caller: AuthenticatedUser,
): Promise<DuplicateSavedArtifactResponse> {
  const supabase = createServiceClient();
  const ctx = await verifyProfessionalPatientWrite(payload.patient_id, caller);

  const { data: original, error: fetchError } = await supabase
    .from('recomendacoes_salvas')
    .select(
      'id, paciente_id, terapeuta_id, clinica_id, tipo_artefato, titulo, conteudo_texto, conteudo, criado_em',
    )
    .eq('id', payload.artifact_id)
    .eq('paciente_id', ctx.patient_id)
    .maybeSingle();

  if (fetchError) {
    throw new AppError({
      code: 'FETCH_ARTIFACT_FAILED',
      message: fetchError.message,
      statusCode: 500,
    });
  }

  if (!original) {
    throw new AppError({
      code: 'ARTIFACT_NOT_FOUND',
      message: 'Documento não encontrado',
      statusCode: 404,
    });
  }

  if (ctx.caller_professional_id !== original.terapeuta_id) {
    throw new AppError({
      code: 'FORBIDDEN',
      message: 'Você não pode duplicar este documento',
      statusCode: 403,
    });
  }

  const markdown = typeof original.conteudo_texto === 'string' ? original.conteudo_texto.trim() : '';
  if (markdown.length < 10 || !original.tipo_artefato) {
    throw new AppError({
      code: 'LEGACY_ARTIFACT',
      message: 'Documentos legados não podem ser duplicados por aqui',
      statusCode: 400,
    });
  }

  const displayTitle = resolveArtifactDisplayTitle({
    titulo: original.titulo as string | null,
    tipo_artefato: original.tipo_artefato as string,
    criado_em: original.criado_em as string,
  });
  const titulo = buildSessionReportCopyTitle(displayTitle);
  const copyId = crypto.randomUUID();
  const fingerprint = await artifactFingerprint(`${markdown}\n#copy:${copyId}`);
  const now = new Date().toISOString();

  const conteudoBase =
    original.conteudo && typeof original.conteudo === 'object' && !Array.isArray(original.conteudo)
      ? (original.conteudo as Record<string, unknown>)
      : {};

  const { data, error } = await supabase
    .from('recomendacoes_salvas')
    .insert({
      paciente_id: ctx.patient_id,
      terapeuta_id: ctx.caller_professional_id,
      clinica_id: ctx.clinic_id,
      tipo_artefato: original.tipo_artefato,
      titulo,
      conteudo_texto: markdown,
      artifact_fingerprint: fingerprint,
      compartilhado_familia: false,
      session_note_id: null,
      conteudo: {
        ...conteudoBase,
        source: 'duplicate',
        duplicated_from: original.id,
        text: markdown,
        saved_at: now,
        shared_with_family: false,
      },
      criado_em: now,
    })
    .select('id, titulo, tipo_artefato, conteudo_texto, criado_em')
    .single();

  if (error || !data) {
    throw new AppError({
      code: 'DUPLICATE_ARTIFACT_FAILED',
      message: error?.message ?? 'Falha ao duplicar documento',
      statusCode: 500,
    });
  }

  await supabase.from('audit_logs').insert({
    user_id: caller.id,
    clinic_id: ctx.clinic_id,
    action: 'ai.artifact_duplicated',
    resource_type: 'saved_recommendation',
    resource_id: data.id,
    metadata: {
      patient_id: ctx.patient_id,
      duplicated_from: original.id,
      tipo_artefato: original.tipo_artefato,
    },
  });

  return {
    id: data.id as string,
    titulo: (data.titulo as string) ?? titulo,
    tipo_artefato: data.tipo_artefato as string,
    conteudo_texto: (data.conteudo_texto as string) ?? markdown,
    compartilhado_familia: false,
    criado_em: data.criado_em as string,
    message: 'Cópia criada. Você pode editar e, se quiser, compartilhar com a família.',
  };
}
