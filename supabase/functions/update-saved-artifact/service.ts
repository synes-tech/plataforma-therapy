import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import { verifyProfessionalPatientWrite } from '../_shared/verify-patient-access.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import { artifactFingerprint } from './fingerprint.ts';
import { validateClinicalMarkdown } from '../_shared/clinical-markdown-normalize.ts';
import type { UpdateSavedArtifactPayload, UpdateSavedArtifactResponse } from './types.ts';

export async function updateSavedArtifact(
  payload: UpdateSavedArtifactPayload,
  caller: AuthenticatedUser,
): Promise<UpdateSavedArtifactResponse> {
  const supabase = createServiceClient();
  const ctx = await verifyProfessionalPatientWrite(payload.patient_id, caller);

  const { data: artifact, error: fetchError } = await supabase
    .from('recomendacoes_salvas')
    .select('id, paciente_id, terapeuta_id, clinica_id, conteudo, tipo_artefato, conteudo_texto')
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

  if (!artifact) {
    throw new AppError({
      code: 'ARTIFACT_NOT_FOUND',
      message: 'Documento não encontrado',
      statusCode: 404,
    });
  }

  if (ctx.caller_professional_id !== artifact.terapeuta_id) {
    throw new AppError({
      code: 'FORBIDDEN',
      message: 'Você não pode editar este documento',
      statusCode: 403,
    });
  }

  if (!artifact.tipo_artefato || !artifact.conteudo_texto) {
    throw new AppError({
      code: 'LEGACY_ARTIFACT',
      message: 'Documentos legados não podem ser editados por aqui',
      statusCode: 400,
    });
  }

  const contentValidation = validateClinicalMarkdown(payload.conteudo_texto);
  if (!contentValidation.ok) {
    throw new AppError({
      code: contentValidation.code,
      message: contentValidation.message,
      statusCode: 400,
    });
  }

  const trimmedContent = contentValidation.normalized;
  const trimmedTitle =
    payload.titulo === undefined
      ? undefined
      : payload.titulo === null
        ? null
        : payload.titulo.trim() || null;

  const fingerprint = await artifactFingerprint(trimmedContent);

  const conteudoBase =
    artifact.conteudo && typeof artifact.conteudo === 'object' && !Array.isArray(artifact.conteudo)
      ? (artifact.conteudo as Record<string, unknown>)
      : {};

  const conteudo = {
    ...conteudoBase,
    text: trimmedContent,
    edited_at: new Date().toISOString(),
    edited_by: caller.id,
  };

  const updatePayload: Record<string, unknown> = {
    conteudo_texto: trimmedContent,
    artifact_fingerprint: fingerprint,
    conteudo,
  };

  if (trimmedTitle !== undefined) {
    updatePayload.titulo = trimmedTitle;
  }

  const { data, error } = await supabase
    .from('recomendacoes_salvas')
    .update(updatePayload)
    .eq('id', artifact.id)
    .select('id, titulo, conteudo_texto, artifact_fingerprint')
    .single();

  if (error || !data) {
    throw new AppError({
      code: 'UPDATE_ARTIFACT_FAILED',
      message: error?.message ?? 'Falha ao salvar alterações',
      statusCode: 500,
    });
  }

  await supabase.from('audit_logs').insert({
    user_id: caller.id,
    clinic_id: ctx.clinic_id,
    action: 'ai.artifact_updated',
    resource_type: 'saved_recommendation',
    resource_id: data.id,
    metadata: {
      patient_id: ctx.patient_id,
      tipo_artefato: artifact.tipo_artefato,
      content_length: trimmedContent.length,
      title_changed: trimmedTitle !== undefined,
    },
  });

  return {
    id: data.id,
    titulo: data.titulo ?? null,
    conteudo_texto: data.conteudo_texto ?? trimmedContent,
    artifact_fingerprint: data.artifact_fingerprint ?? fingerprint,
    message: 'Documento atualizado com sucesso',
  };
}
