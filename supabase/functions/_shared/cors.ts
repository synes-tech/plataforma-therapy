const ALLOWED_ORIGINS = Deno.env.get('ALLOWED_ORIGINS')?.split(',') ?? [];

export function getCorsHeaders(origin?: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] ?? '';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Idempotency-Key, X-Request-ID',
    'Access-Control-Max-Age': '86400',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  };
}

export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('origin');
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(origin),
    });
  }
  return null;
}
