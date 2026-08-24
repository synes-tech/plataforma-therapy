import { createServiceClient } from './supabase.ts';
import { artifactFingerprint } from '../save-ai-artifact/fingerprint.ts';
import { buildSessionReportArtifactTitle } from './session-artifact-title.ts';

export interface SyncSessionArtifactInput {
  sessionNoteId: string;
  patientId: string;
  patientName: string;
  professionalId: string;
  clinicId: string;
  markdown: string;
  sessionAtIso: string;
  callerId: string;
}

/** Upsert do relatório canônico em Documentos salvos (1 por session_note). Sempre interno. */
export async function syncSessionNoteToSavedArtifact(input: SyncSessionArtifactInput): Promise<void> {
  const markdown = input.markdown.trim();
  if (markdown.length < 10) return;

  const supabase = createServiceClient();
  const titulo = buildSessionReportArtifactTitle(input.sessionAtIso, input.patientName);
  const fingerprint = await artifactFingerprint(`${markdown}\n#session_note:${input.sessionNoteId}`);
  const now = new Date().toISOString();

  const conteudo = {
    source: 'session_approval',
    tipo_artefato: 'relatorio_sessao',
    session_note_id: input.sessionNoteId,
    text: markdown,
    saved_at: now,
    shared_with_family: false,
  };

  const { data: existing } = await supabase
    .from('recomendacoes_salvas')
    .select('id')
    .eq('session_note_id', input.sessionNoteId)
    .maybeSingle();

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from('recomendacoes_salvas')
      .update({
        titulo,
        conteudo_texto: markdown,
        artifact_fingerprint: fingerprint,
        conteudo,
      })
      .eq('id', existing.id);

    if (updateError) {
      console.error('[sync-session-artifact] update failed', updateError.message);
    }
    return;
  }

  const { error: insertError } = await supabase.from('recomendacoes_salvas').insert({
    paciente_id: input.patientId,
    terapeuta_id: input.professionalId,
    clinica_id: input.clinicId,
    tipo_artefato: 'relatorio_sessao',
    titulo,
    conteudo_texto: markdown,
    artifact_fingerprint: fingerprint,
    compartilhado_familia: false,
    session_note_id: input.sessionNoteId,
    conteudo,
    criado_em: now,
  });

  if (insertError) {
    console.error('[sync-session-artifact] insert failed', insertError.message);
    return;
  }

  await supabase.from('audit_logs').insert({
    user_id: input.callerId,
    clinic_id: input.clinicId,
    action: 'ai.session_report_saved',
    resource_type: 'saved_recommendation',
    resource_id: input.sessionNoteId,
    metadata: {
      patient_id: input.patientId,
      session_note_id: input.sessionNoteId,
      tipo_artefato: 'relatorio_sessao',
    },
  });
}
