import { AppError } from './errors.ts';
import { createServiceClient } from './supabase.ts';
import type { AuthenticatedUser } from './auth.ts';

export interface RateLimitConsumeResult {
  allowed: boolean;
  count: number;
  limit: number;
  retry_after_seconds: number;
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for') ?? '';
  const first = forwarded.split(',')[0]?.trim();
  return first || req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || 'unknown';
}

export function formatRetryAfter(seconds: number): string {
  const safe = Math.max(1, Math.ceil(seconds));
  if (safe < 60) {
    return safe === 1 ? '1 segundo' : `${safe} segundos`;
  }
  const minutes = Math.ceil(safe / 60);
  if (minutes < 60) {
    return minutes === 1 ? '1 minuto' : `${minutes} minutos`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourLabel = hours === 1 ? '1 hora' : `${hours} horas`;
  if (rest === 0) return hourLabel;
  return `${hourLabel} e ${rest === 1 ? '1 minuto' : `${rest} minutos`}`;
}

export function rateLimitedError(retryAfterSeconds: number): AppError {
  const retry = Math.max(1, Math.ceil(retryAfterSeconds));
  return new AppError({
    code: 'RATE_LIMITED',
    message: `Muitas tentativas. Tente novamente em ${formatRetryAfter(retry)}.`,
    statusCode: 429,
    details: { retry_after_seconds: retry },
  });
}

async function hashKey(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value.trim().toLowerCase());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

export async function consumeRateLimit(params: {
  bucket: string;
  key: string;
  limit: number;
  windowSec: number;
}): Promise<RateLimitConsumeResult> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('consume_rate_limit', {
    p_bucket: params.bucket,
    p_key: params.key,
    p_limit: params.limit,
    p_window_seconds: params.windowSec,
  });

  if (error) {
    console.error(JSON.stringify({
      level: 'error',
      action: 'consume_rate_limit_failed',
      message: error.message,
      bucket: params.bucket,
    }));
    return { allowed: true, count: 0, limit: params.limit, retry_after_seconds: 0 };
  }

  const row = data as RateLimitConsumeResult;
  return {
    allowed: row?.allowed !== false,
    count: Number(row?.count ?? 0),
    limit: Number(row?.limit ?? params.limit),
    retry_after_seconds: Number(row?.retry_after_seconds ?? 0),
  };
}

export async function assertRateLimit(params: {
  bucket: string;
  key: string;
  limit: number;
  windowSec: number;
}): Promise<void> {
  const result = await consumeRateLimit(params);
  if (!result.allowed) {
    throw rateLimitedError(result.retry_after_seconds);
  }
}

export async function assertIpRateLimit(
  req: Request,
  params: { bucket: string; limit: number; windowSec: number },
): Promise<void> {
  const ip = clientIp(req);
  await assertRateLimit({
    bucket: params.bucket,
    key: `ip:${await hashKey(ip)}`,
    limit: params.limit,
    windowSec: params.windowSec,
  });
}

export async function assertEmailRateLimit(params: {
  bucket: string;
  email: string;
  limit: number;
  windowSec: number;
}): Promise<void> {
  await assertRateLimit({
    bucket: params.bucket,
    key: `email:${await hashKey(params.email)}`,
    limit: params.limit,
    windowSec: params.windowSec,
  });
}

export type AiRateKind = 'copilot' | 'session' | 'report' | 'family' | 'companion';

const AI_LIMITS: Record<AiRateKind, { userHour: number; userBurst?: { limit: number; windowSec: number }; clinicHour: number }> = {
  copilot: { userHour: 80, userBurst: { limit: 20, windowSec: 300 }, clinicHour: 250 },
  session: { userHour: 30, clinicHour: 80 },
  report: { userHour: 25, clinicHour: 60 },
  family: { userHour: 20, clinicHour: 60 },
  // Quotas largas de propósito: cortar alguém em crise por rate limit é pior que um pico de custo.
  companion: { userHour: 120, userBurst: { limit: 30, windowSec: 300 }, clinicHour: 400 },
};

export async function assertAiRateLimit(user: AuthenticatedUser, kind: AiRateKind): Promise<void> {
  const limits = AI_LIMITS[kind];
  await assertRateLimit({
    bucket: `ai_${kind}_user`,
    key: `user:${user.id}`,
    limit: limits.userHour,
    windowSec: 3600,
  });
  if (limits.userBurst) {
    await assertRateLimit({
      bucket: `ai_${kind}_burst`,
      key: `user:${user.id}`,
      limit: limits.userBurst.limit,
      windowSec: limits.userBurst.windowSec,
    });
  }
  if (user.clinic_id) {
    await assertRateLimit({
      bucket: `ai_${kind}_clinic`,
      key: `clinic:${user.clinic_id}`,
      limit: limits.clinicHour,
      windowSec: 3600,
    });
  }
}
