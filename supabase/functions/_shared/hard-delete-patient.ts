import { createServiceClient } from './supabase.ts';

const AUDIO_BUCKET = 'audio-recordings';
const AVATAR_BUCKET = 'pacientes-avatars';
const FAMILY_AUDIO_BUCKET = 'family-diary-audio';

async function removeStoragePaths(bucket: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const supabase = createServiceClient();
  const unique = [...new Set(paths.filter(Boolean))];
  const chunkSize = 50;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const { error } = await supabase.storage.from(bucket).remove(chunk);
    if (error) {
      console.error(`storage.remove failed bucket=${bucket}`, error.message);
    }
  }
}

/** Exclusão física irreversível — ordem respeita FKs RESTRICT. */
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
    .single();

  const avatarPaths = patientRow?.foto_url ? [patientRow.foto_url as string] : [];

  const { data: diaryAudio } = await supabase
    .from('diary_entries')
    .select('audio_note_url')
    .eq('patient_id', patientId)
    .not('audio_note_url', 'is', null);

  const familyAudioPaths = (diaryAudio ?? [])
    .map((r) => r.audio_note_url as string | null)
    .filter((p): p is string => Boolean(p));

  await supabase.from('patient_embeddings').delete().eq('patient_id', patientId);
  await supabase.from('crisis_alerts').delete().eq('patient_id', patientId);
  await supabase.from('audio_transcriptions').delete().eq('patient_id', patientId);
  await supabase.from('session_notes').delete().eq('patient_id', patientId);
  await supabase.from('audio_recordings').delete().eq('patient_id', patientId);
  await supabase.from('ai_jobs').delete().eq('patient_id', patientId);
  await supabase.from('diary_entries').delete().eq('patient_id', patientId);
  await supabase.from('invites').delete().eq('patient_id', patientId);
  await supabase.from('agreements').delete().eq('patient_id', patientId);
  await supabase.from('patient_family_links').delete().eq('patient_id', patientId);
  await supabase.from('family_members').delete().eq('patient_id', patientId);
  await supabase.from('therapist_schedule').delete().eq('patient_id', patientId);

  const { error: deletePatientError } = await supabase
    .from('patients')
    .delete()
    .eq('id', patientId)
    .eq('clinic_id', clinicId);

  if (deletePatientError) {
    throw deletePatientError;
  }

  await Promise.all([
    removeStoragePaths(AUDIO_BUCKET, audioPaths),
    removeStoragePaths(AVATAR_BUCKET, avatarPaths),
    removeStoragePaths(FAMILY_AUDIO_BUCKET, familyAudioPaths),
  ]);
}
