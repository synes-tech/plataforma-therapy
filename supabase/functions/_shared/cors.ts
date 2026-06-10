/**
 * CORS global — homologação/produção inicial.
 * Todas as Edge Functions usam handleCors() + response.ts (que anexa estes headers).
 */
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-idempotency-key, x-request-id',
  'Access-Control-Max-Age': '86400',
};

/** Headers de resposta: CORS + hardening básico. */
export function getCorsHeaders(_origin?: string | null): Record<string, string> {
  return {
    ...corsHeaders,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  };
}

/**
 * Intercepta preflight OPTIONS antes de auth/DB.
 * Chamar no topo de todo serve(): if (corsResponse) return corsResponse;
 */
export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }
  return null;
}
