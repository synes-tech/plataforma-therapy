export const AUDIO_SKIP_SECONDS = 10;

export const AUDIO_PLAYBACK_RATES = [0.5, 0.75, 1, 1.5, 2] as const;

export type AudioPlaybackRate = (typeof AUDIO_PLAYBACK_RATES)[number];

/** Novo currentTime após pular, limitado entre 0 e a duração. */
export function skipAudioTime(currentTime: number, deltaSeconds: number, duration: number): number {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const next = currentTime + deltaSeconds;
  if (next < 0) return 0;
  if (safeDuration > 0 && next > safeDuration) return safeDuration;
  return next;
}

export function isAudioPlaybackRate(value: number): value is AudioPlaybackRate {
  return (AUDIO_PLAYBACK_RATES as readonly number[]).includes(value);
}

/** Cicla 0.5x → 0.75x → 1x → 1.5x → 2x → 0.5x. */
export function nextAudioPlaybackRate(rate: number): AudioPlaybackRate {
  const index = AUDIO_PLAYBACK_RATES.findIndex((item) => item === rate);
  if (index === -1) return 1;
  return AUDIO_PLAYBACK_RATES[(index + 1) % AUDIO_PLAYBACK_RATES.length]!;
}

export function formatAudioPlaybackRate(rate: number): string {
  if (rate === 0.5) return '0.5x';
  if (rate === 0.75) return '0.75x';
  if (rate === 1) return '1x';
  if (rate === 1.5) return '1.5x';
  if (rate === 2) return '2x';
  return `${rate}x`;
}

/** Converte a posição do ponteiro na barra no tempo correspondente do áudio. */
export function seekTimeFromBar(
  clientX: number,
  barLeft: number,
  barWidth: number,
  duration: number,
): number {
  if (barWidth <= 0 || !Number.isFinite(duration) || duration <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, (clientX - barLeft) / barWidth));
  return ratio * duration;
}
