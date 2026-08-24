import { createServiceClient } from './supabase.ts';
import { removePaths, type LogicalBucket } from './object-storage.ts';
import { postgrestErrorMessage } from './hard-delete-patient.utils.ts';

export { postgrestErrorMessage };

const AUDIO_BUCKET: LogicalBucket = 'audio-recordings';
const AVATAR_BUCKET: LogicalBucket = 'pacientes-avatars';
const FAMILY_AUDIO_BUCKET: LogicalBucket = 'family-diary-audio';
const ATTACHMENTS_BUCKET: LogicalBucket = 'pacientes-anexos';

type ServiceClient = ReturnType<typeof createServiceClient>;

async function removeStoragePaths(bucket: LogicalBucket, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const unique = [...new Set(paths.filter(Boolean))];
  try {
    await removePaths(bucket, unique);
  } catch (err) {
    console.error(
      `storage.remove failed bucket=${bucket}`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

async function mustDelete(
  supabase: ServiceClient,
  table: string,
  column: 'patient_id' | 'paciente_id',
  patientId: string,
): Promise<void> {
  const { error } = await supabase.from(table).delete().eq(column, patientId);
  if (error) {
    throw new Error(`${table}: ${postgrestErrorMessage(error)}`);
  }
}

/**
 * Exclusão física irreversível.
 *
 * A ordem importa: várias tabelas novas (financeiro, copiloto B2B, assinatura B2C)
 * apontam para `patients` com ON DELETE RESTRICT. Apagar só o núcleo antigo
 * deixa o DELETE final falhar com 500.
 */
export async function hardDeletePatientData(patientId: string, clinicId: string): Promise<void> {
  const supabase = createServiceClient();

  const { data: audioRows } = await supabase
    .from('audio_recordings')
    .select('storage_path')
    .eq('patient_id', patientId);

  const audioPaths = (audioRows ?? []).map((r) => r.storage_path as string);

  const { data: patientRow } = await supabase
    .from('patients')
    .select('foto_url')
    .eq('id', patientId)
    .maybeSingle();

  const avatarPaths = patientRow?.foto_url ? [patientRow.foto_url as string] : [];

  const { data: diaryAudio } = await supabase
    .from('diary_entries')
    .select('audio_note_url')
    .eq('patient_id', patientId)
    .not('audio_note_url', 'is', null);

  const familyAudioPaths = (diaryAudio ?? [])
    .map((r) => r.audio_note_url as string | null)
    .filter((p): p is string => Boolean(p));

  const { data: attachmentRows } = await supabase
    .from('patient_attachments')
    .select('storage_path')
    .eq('patient_id', patientId);

  const attachmentPaths = (attachmentRows ?? []).map((r) => r.storage_path as string);

  // Rompe ciclos (agenda ↔ nota ↔ áudio) antes de apagar qualquer um dos três.
  const nullUpdates: Array<{ table: string; patch: Record<string, null>; column: string }> = [
    { table: 'therapist_schedule', patch: { session_note_id: null }, column: 'patient_id' },
    { table: 'session_notes', patch: { schedule_id: null, audio_recording_id: null, transcription_id: null }, column: 'patient_id' },
    { table: 'audio_recordings', patch: { schedule_id: null }, column: 'patient_id' },
    { table: 'financeiro_sessoes_cobranca', patch: { transacao_id: null }, column: 'patient_id' },
    { table: 'financeiro_transacoes', patch: { sessao_id: null, contract_id: null }, column: 'paciente_id' },
  ];

  for (const step of nullUpdates) {
    const { error } = await supabase.from(step.table).update(step.patch).eq(step.column, patientId);
    if (error) {
      throw new Error(`${step.table} (desvincular): ${postgrestErrorMessage(error)}`);
    }
  }

  const byPatientId: string[] = [
    'copilot_messages',
    'copilot_threads',
    'companion_clinical_summaries',
    'clinical_alerts',
    'patient_copilot_messages',
    'patient_copilot_threads',
    'patient_copilot_usage',
    'patient_consents',
    'patient_subscriptions',
    'patient_embeddings',
    'patient_conditions',
    'patient_proactive_summaries',
    'push_reminder_log',
    'crisis_alerts',
    'ai_jobs',
    'session_email_jobs',
    'financeiro_sessoes_cobranca',
    'financeiro_contrato_janelas',
    'financeiro_planos_paciente',
    'session_notes',
    'audio_transcriptions',
    'audio_recordings',
    'patient_attachments',
    'diary_entries',
    'agreements',
    'invites',
    'patient_family_links',
    'family_members',
    'therapist_schedule',
  ];

  for (const table of byPatientId) {
    await mustDelete(supabase, table, 'patient_id', patientId);
  }

  await mustDelete(supabase, 'recomendacoes_salvas', 'paciente_id', patientId);
  await mustDelete(supabase, 'financeiro_saldos_pacientes', 'paciente_id', patientId);
  await mustDelete(supabase, 'financeiro_transacoes', 'paciente_id', patientId);

  const { error: deletePatientError } = await supabase
    .from('patients')
    .delete()
    .eq('id', patientId)
    .eq('clinic_id', clinicId);

  if (deletePatientError) {
    throw new Error(`patients: ${postgrestErrorMessage(deletePatientError)}`);
  }

  await Promise.all([
    removeStoragePaths(AUDIO_BUCKET, audioPaths),
    removeStoragePaths(AVATAR_BUCKET, avatarPaths),
    removeStoragePaths(FAMILY_AUDIO_BUCKET, familyAudioPaths),
    removeStoragePaths(ATTACHMENTS_BUCKET, attachmentPaths),
  ]);
}
