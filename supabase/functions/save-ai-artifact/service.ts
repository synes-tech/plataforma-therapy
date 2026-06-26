import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import { verifyProfessionalPatientWrite } from '../_shared/verify-patient-access.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import { artifactFingerprint } from './fingerprint.ts';
import { validateClinicalMarkdown } from '../_shared/clinical-markdown-normalize.ts';
import type { SaveAiArtifactPayload, SaveAiArtifactResponse } from './types.ts';

const ARTIFACT_LABELS: Record<SaveAiArtifactPayload['tipo_artefato'], string> = {
  acao_recomendada: 'Ação recomendada',
  resumo_proativo: 'Resumo proativo',
  relatorio_sessao: 'Relatório de sessão',
};

export async function saveAiArtifact(
  payload: SaveAiArtifactPayload,
  caller: AuthenticatedUser,
): Promise<SaveAiArtifactResponse> {
  const supabase = createServiceClient();
  const ctx = await verifyProfessionalPatientWrite(payload.patient_id, caller);

  const contentValidation = validateClinicalMarkdown(payload.conteudo_texto);
  if (!contentValidation.ok) {
    throw new AppError({
      code: contentValidation.code,
      message: contentValidation.message,
      statusCode: 400,
    });
  }

  const normalizedContent = contentValidation.normalized;
  const fingerprint = await artifactFingerprint(normalizedContent);

  const sharedWithFamily = payload.compartilhado_familia === true;

  const { data: existing } = await supabase
    .from('recomendacoes_salvas')
    .select('id, criado_em, compartilhado_familia')
    .eq('paciente_id', ctx.patient_id)
    .eq('terapeuta_id', ctx.caller_professional_id)
    .eq('tipo_artefato', payload.tipo_artefato)
    .eq('artifact_fingerprint', fingerprint)
    .maybeSingle();

  if (existing) {
    return {
      id: existing.id,
      criado_em: existing.criado_em,
      artifact_fingerprint: fingerprint,
      tipo_artefato: payload.tipo_artefato,
      compartilhado_familia: existing.compartilhado_familia === true,
      already_saved: true,
      message: `${ARTIFACT_LABELS[payload.tipo_artefato]} já estava salvo`,
    };
  }

  const now = new Date().toISOString();
  const conteudo = {
    source: 'copilot_chat',
    tipo_artefato: payload.tipo_artefato,
    text: normalizedContent,
    saved_at: now,
    shared_with_family: sharedWithFamily,
  };

  const { data, error } = await supabase
    .from('recomendacoes_salvas')
    .insert({
      paciente_id: ctx.patient_id,
      terapeuta_id: ctx.caller_professional_id,
      clinica_id: ctx.clinic_id,
      tipo_artefato: payload.tipo_artefato,
      conteudo_texto: normalizedContent,
      artifact_fingerprint: fingerprint,
      compartilhado_familia: sharedWithFamily,
      conteudo,
    })
    .select('id, criado_em, compartilhado_familia')
    .single();

  if (error || !data) {
    throw new AppError({
      code: 'SAVE_ARTIFACT_FAILED',
      message: error?.message ?? 'Falha ao salvar artefato',
      statusCode: 500,
    });
  }

  await supabase.from('audit_logs').insert({
    user_id: caller.id,
    clinic_id: ctx.clinic_id,
    action: 'ai.artifact_saved',
    resource_type: 'saved_recommendation',
    resource_id: data.id,
    metadata: {
      patient_id: ctx.patient_id,
      tipo_artefato: payload.tipo_artefato,
      artifact_fingerprint: fingerprint,
      compartilhado_familia: sharedWithFamily,
    },
  });

  return {
    id: data.id,
    criado_em: data.criado_em,
    artifact_fingerprint: fingerprint,
    tipo_artefato: payload.tipo_artefato,
    compartilhado_familia: data.compartilhado_familia === true,
    already_saved: false,
    message: `${ARTIFACT_LABELS[payload.tipo_artefato]} salvo com sucesso`,
  };
}
