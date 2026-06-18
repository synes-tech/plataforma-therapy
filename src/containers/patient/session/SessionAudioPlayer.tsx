import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@shared/lib/supabase';
import { formatSessionDuration } from './session-history.utils';

interface SessionAudioPlayerProps {
  storagePath: string;
  mimeType?: string | null;
  durationSeconds?: number | null;
}

export function SessionAudioPlayer({
  storagePath,
  mimeType,
  durationSeconds,
}: SessionAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds ?? 0);

  useEffect(() => {
    let cancelled = false;

    async function loadUrl() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: signError } = await supabase.storage
          .from('audio-recordings')
          .createSignedUrl(storagePath, 3600);

        if (signError || !data?.signedUrl) {
          throw new Error(signError?.message ?? 'Não foi possível carregar o áudio');
        }

        if (!cancelled) {
          setSignedUrl(data.signedUrl);
        }
      } catch {
        if (!cancelled) {
          setError('Áudio indisponível ou sem permissão de acesso.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadUrl();
    return () => {
      cancelled = true;
    };
  }, [storagePath]);

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }

    try {
      await audio.play();
      setPlaying(true);
    } catch {
      setError('Não foi possível reproduzir o áudio.');
    }
  }, [playing]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="text-xs text-charcoal-muted">Carregando áudio...</span>
      </div>
    );
  }

  if (error || !signedUrl) {
    return (
      <div className="rounded-xl border border-error/15 bg-error-light/30 px-4 py-3 text-xs text-error">
        {error ?? 'Áudio indisponível.'}
      </div>
    );
  }

  const displayDuration = duration || durationSeconds || 0;

  return (
    <div className="rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
      <audio
        ref={audioRef}
        src={signedUrl}
        preload="metadata"
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          setCurrentTime(el.currentTime);
          if (el.duration && Number.isFinite(el.duration)) {
            setDuration(el.duration);
            setProgress((el.currentTime / el.duration) * 100);
          }
        }}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d)) setDuration(d);
        }}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
          setCurrentTime(0);
        }}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      >
        {mimeType ? <source src={signedUrl} type={mimeType} /> : null}
      </audio>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void togglePlay()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-sm transition hover:bg-primary-dark"
          aria-label={playing ? 'Pausar áudio' : 'Reproduzir áudio'}
        >
          {playing ? (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M6 5h4v14H6V5zm8 0h4v14h-4V5z" />
            </svg>
          ) : (
            <svg className="h-4 w-4 translate-x-0.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5v14l11-7L8 5z" />
            </svg>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] tabular-nums text-charcoal-muted">
            <span>{formatSessionDuration(Math.floor(currentTime)) || '0:00'}</span>
            <span>{formatSessionDuration(Math.floor(displayDuration)) || '--:--'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
