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
    timestamp: body.meta.timestamp,
  }));

  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(origin),
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
