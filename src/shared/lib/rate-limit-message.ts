export type RateLimitedError = Error & {
  code: 'RATE_LIMITED';
  retryAfterSeconds?: number;
};

export function isRateLimitedError(err: unknown): err is RateLimitedError {
  return err instanceof Error && (err as { code?: string }).code === 'RATE_LIMITED';
}

export function getRetryAfterSeconds(err: unknown): number {
  if (!isRateLimitedError(err)) return 0;
  const n = Number(err.retryAfterSeconds);
  if (Number.isFinite(n) && n > 0) return Math.ceil(n);
  return 60;
}

export function formatRetryAfter(seconds: number): string {
  const safe = Math.max(1, Math.ceil(seconds));
  if (safe < 60) {
    return safe === 1 ? '1 segundo' : `${safe} segundos`;
  }
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  if (minutes < 60) {
    if (rest === 0) return minutes === 1 ? '1 minuto' : `${minutes} minutos`;
    const minLabel = minutes === 1 ? '1 minuto' : `${minutes} minutos`;
    const secLabel = rest === 1 ? '1 segundo' : `${rest} segundos`;
    return `${minLabel} e ${secLabel}`;
  }
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  const hourLabel = hours === 1 ? '1 hora' : `${hours} horas`;
  if (remMin === 0) return hourLabel;
  return `${hourLabel} e ${remMin === 1 ? '1 minuto' : `${remMin} minutos`}`;
}

export function rateLimitUserMessage(seconds: number): string {
  if (seconds <= 0) return 'Você já pode tentar novamente.';
  return `Muitas tentativas. Tente novamente em ${formatRetryAfter(seconds)}.`;
}
