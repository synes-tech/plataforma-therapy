import { useCallback, useEffect, useRef, useState } from 'react';
import { Spinner } from '@containers/loading';
import { getSignedReadUrl } from '@shared/lib/signed-read-url';
import { formatSessionDuration } from './session-history.utils';
import {
  AUDIO_PLAYBACK_RATES,
  AUDIO_SKIP_SECONDS,
  formatAudioPlaybackRate,
  skipAudioTime,
  seekTimeFromBar,
  type AudioPlaybackRate,
} from './session-audio-player.utils';

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
  const [rate, setRate] = useState<AudioPlaybackRate>(1);
  const [scrubbing, setScrubbing] = useState(false);
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadUrl() {
      setLoading(true);
      setError(null);
      try {
        const url = await getSignedReadUrl('audio-recordings', storagePath, 3600);
        if (!cancelled) {
          setSignedUrl(url);
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

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = rate;
  }, [rate, signedUrl]);

  const syncFromAudio = useCallback((el: HTMLAudioElement) => {
    setCurrentTime(el.currentTime);
    if (el.duration && Number.isFinite(el.duration)) {
      setDuration(el.duration);
      setProgress((el.currentTime / el.duration) * 100);
    }
  }, []);

  const seekTo = useCallback(
    (nextTime: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = nextTime;
      syncFromAudio(audio);
    },
    [syncFromAudio],
  );

  const skipBy = useCallback(
    (deltaSeconds: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      const total = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : duration;
      seekTo(skipAudioTime(audio.currentTime, deltaSeconds, total));
    },
    [duration, seekTo],
  );

  const seekFromPointer = useCallback(
    (clientX: number) => {
      const bar = barRef.current;
      const audio = audioRef.current;
      if (!bar || !audio) return;
      const rect = bar.getBoundingClientRect();
      const total =
        Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : duration;
      seekTo(seekTimeFromBar(clientX, rect.left, rect.width, total));
    },
    [duration, seekTo],
  );

  const togglePlay = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }

    try {
      audio.playbackRate = rate;
      await audio.play();
      setPlaying(true);
    } catch {
      setError('Não foi possível reproduzir o áudio.');
    }
  }, [playing, rate]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
        <Spinner size="md" />
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
          if (scrubbing) return;
          syncFromAudio(e.currentTarget);
        }}
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          el.playbackRate = rate;
          const d = el.duration;
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

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex shrink-0 items-center gap-1">
          <SkipButton
            direction="back"
            onClick={() => skipBy(-AUDIO_SKIP_SECONDS)}
            label={`Voltar ${AUDIO_SKIP_SECONDS} segundos`}
          />
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
          <SkipButton
            direction="forward"
            onClick={() => skipBy(AUDIO_SKIP_SECONDS)}
            label={`Avançar ${AUDIO_SKIP_SECONDS} segundos`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div
            ref={barRef}
            role="slider"
            tabIndex={0}
            aria-label="Posição do áudio"
            aria-valuemin={0}
            aria-valuemax={Math.round(displayDuration)}
            aria-valuenow={Math.round(currentTime)}
            aria-valuetext={`${formatSessionDuration(Math.floor(currentTime)) || '0:00'} de ${formatSessionDuration(Math.floor(displayDuration)) || '--:--'}`}
            className="group relative flex h-5 cursor-pointer items-center touch-none"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              setScrubbing(true);
              seekFromPointer(event.clientX);
            }}
            onPointerMove={(event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
              seekFromPointer(event.clientX);
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
              setScrubbing(false);
            }}
            onPointerCancel={() => setScrubbing(false)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight') {
                event.preventDefault();
                skipBy(AUDIO_SKIP_SECONDS);
              }
              if (event.key === 'ArrowLeft') {
                event.preventDefault();
                skipBy(-AUDIO_SKIP_SECONDS);
              }
              if (event.key === 'Home') {
                event.preventDefault();
                seekTo(0);
              }
              if (event.key === 'End') {
                event.preventDefault();
                seekTo(displayDuration);
              }
            }}
          >
            <span className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <span
                className={`block h-full rounded-full bg-primary ${scrubbing ? '' : 'transition-[width] duration-150'}`}
                style={{ width: `${progress}%` }}
              />
            </span>
            <span
              className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow-sm transition-opacity ${
                scrubbing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
              }`}
              style={{ left: `${progress}%` }}
              aria-hidden
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10px] tabular-nums text-charcoal-muted">
            <span>{formatSessionDuration(Math.floor(currentTime)) || '0:00'}</span>
            <span>{formatSessionDuration(Math.floor(displayDuration)) || '--:--'}</span>
          </div>
          <div
            className="mt-1.5 flex w-full items-center gap-0.5 overflow-x-auto rounded-full bg-slate-100 p-0.5"
            role="group"
            aria-label="Velocidade de reprodução"
          >
            {AUDIO_PLAYBACK_RATES.map((option) => {
              const active = option === rate;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setRate(option)}
                  aria-pressed={active}
                  className={`h-6 flex-1 rounded-full px-1 text-[10px] font-semibold tabular-nums transition ${
                    active
                      ? 'bg-charcoal text-white shadow-sm'
                      : 'text-charcoal-muted hover:text-charcoal'
                  }`}
                >
                  {formatAudioPlaybackRate(option)}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function SkipButton({
  direction,
  onClick,
  label,
}: {
  direction: 'back' | 'forward';
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-full text-charcoal-muted transition hover:bg-slate-100 hover:text-charcoal"
    >
      {direction === 'back' ? (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
          <path d="M11 6.5v11L3.5 12 11 6.5zm9.5 0v11L12 12l8.5-5.5z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
          <path d="M3.5 6.5 12 12l-8.5 5.5v-11zm9.5 0L21.5 12 13 17.5v-11z" />
        </svg>
      )}
      <span className="text-[8px] font-bold leading-none tabular-nums" aria-hidden>
        {AUDIO_SKIP_SECONDS}
      </span>
    </button>
  );
}
