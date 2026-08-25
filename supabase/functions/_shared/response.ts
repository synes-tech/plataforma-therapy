import { getCorsHeaders } from './cors.ts';
import { AppError } from './errors.ts';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: {
    request_id: string;
    timestamp: string;
  };
}

function buildMeta(requestId?: string): ApiResponse['meta'] {
  return {
    request_id: requestId ?? crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
}

function looksLikeStripeError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const rec = error as { type?: unknown; message?: unknown };
  if (typeof rec.type === 'string' && rec.type.toLowerCase().includes('stripe')) return true;
  return typeof rec.message === 'string' && /No such (customer|price|product)|price specified is inactive/i.test(rec.message);
}

export function successResponse<T>(data: T, req: Request, statusCode = 200): Response {
  const origin = req.headers.get('origin');
  const requestId = req.headers.get('x-request-id') ?? undefined;

  const body: ApiResponse<T> = {
    success: true,
    data,
    meta: buildMeta(requestId),
  };

  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(origin),
    },
  });
}

export function errorResponse(error: unknown, req: Request): Response {
  const origin = req.headers.get('origin');
  const requestId = req.headers.get('x-request-id') ?? undefined;

  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';
  let details: unknown = undefined;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
    details = error.details;
  } else if (looksLikeStripeError(error)) {
    statusCode = 502;
    code = 'STRIPE_CHECKOUT_FAILED';
    message = 'Não foi possível abrir o checkout do Stripe. Tente novamente.';
  }

  const body: ApiResponse = {
    success: false,
    error: { code, message, ...(details ? { details } : {}) },
    meta: buildMeta(requestId),
  };

  // Log structured error for observability
  console.error(JSON.stringify({
    level: 'error',
    trace_id: body.meta.request_id,
    error_code: code,
    message,
    status_code: statusCode,
    cause: error instanceof Error && !(error instanceof AppError) ? error.message : undefined,
    timestamp: body.meta.timestamp,
  }));

  const retryAfter =
    details &&
    typeof details === 'object' &&
    'retry_after_seconds' in details &&
    typeof (details as { retry_after_seconds?: unknown }).retry_after_seconds === 'number'
      ? String(Math.max(1, Math.ceil((details as { retry_after_seconds: number }).retry_after_seconds)))
      : null;

  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(origin),
      ...(retryAfter ? { 'Retry-After': retryAfter } : {}),
    },
  });
}

export function acceptedResponse(jobId: string, req: Request): Response {
  const origin = req.headers.get('origin');
  const requestId = req.headers.get('x-request-id') ?? undefined;

  const body: ApiResponse<{ job_id: string }> = {
    success: true,
    data: { job_id: jobId },
    meta: buildMeta(requestId),
  };

  return new Response(JSON.stringify(body), {
    status: 202,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(origin),
    },
  });
}
