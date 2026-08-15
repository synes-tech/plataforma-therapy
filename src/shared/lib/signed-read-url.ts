import { callFunction } from './api';

export type StorageBucket =
  | 'audio-recordings'
  | 'family-diary-audio'
  | 'pacientes-anexos'
  | 'pacientes-avatars'
  | 'profissionais-avatars';

/**
 * Obtém URL assinada de leitura via backend (GCS ou Supabase).
 * Substitui `supabase.storage.createSignedUrl` no browser.
 */
export async function getSignedReadUrl(
  bucket: StorageBucket,
  path: string,
  expiresIn = 3600,
): Promise<string> {
  const data = await callFunction<{ url: string }>('get-signed-read-url', {
    bucket,
    path,
    expires_in: expiresIn,
  });
  if (!data.url) {
    throw new Error('URL assinada indisponível');
  }
  return data.url;
}
