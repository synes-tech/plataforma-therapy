import { useState } from 'react';
import { supabase } from '@shared/lib/supabase';

interface Props {
  storagePath: string;
}

export function FamilyDiaryAudioPlay({ storagePath }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePlay() {
    setLoading(true);
    setError(null);
    try {
      const { data, error: signError } = await supabase.storage
        .from('family-diary-audio')
        .createSignedUrl(storagePath, 300);

      if (signError || !data?.signedUrl) {
        throw new Error(signError?.message ?? 'Não foi possível carregar o áudio');
      }

      const audio = new Audio(data.signedUrl);
      await audio.play();
    } catch {
      setError('Áudio indisponível');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handlePlay}
      disabled={loading}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/15 disabled:opacity-50"
      aria-label="Ouvir relato em áudio da família"
      title={error ?? 'Ouvir áudio original'}
    >
      {loading ? (
        <span className="h-3 w-3 animate-spin rounded-full border border-primary border-t-transparent" />
      ) : (
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
        </svg>
      )}
    </button>
  );
}
