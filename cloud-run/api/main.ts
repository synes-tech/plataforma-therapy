/**
 * Unithery Cloud Run API — router único para Edge Functions + proxy PostgREST/Auth.
 * Paths compatíveis com o FE atual: /functions/v1/:name
 */
import {
  getHandler,
  listHandlers,
  setCurrentFunctionName,
} from './serve-shim.ts';
import { authenticateRequest } from '../../supabase/functions/_shared/auth.ts';
import { UnauthorizedError } from '../../supabase/functions/_shared/errors.ts';

const FUNCTIONS_ROOT = new URL('../../supabase/functions/', import.meta.url);

async function loadAllFunctions(): Promise<void> {
  const names: string[] = [];
  for await (const entry of Deno.readDir(FUNCTIONS_ROOT)) {
    if (!entry.isDirectory || entry.name.startsWith('_')) continue;
    names.push(entry.name);
  }
  names.sort();

  for (const name of names) {
    setCurrentFunctionName(name);
    try {
      await import(new URL(`./${name}/index.ts`, FUNCTIONS_ROOT).href);
    } catch (err) {
      console.error(`[router] failed to load ${name}:`, err);
    }
  }
  console.log(`[router] loaded ${listHandlers().length}/${names.length} handlers`);
}

function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get('Origin') ?? '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    // supabase-js + PostgREST enviam accept-profile / x-retry-count / prefer etc.
    'Access-Control-Allow-Headers': [
      'authorization',
      'x-client-info',
      'apikey',
      'content-type',
      'accept',
      'prefer',
      'accept-profile',
      'content-profile',
      'x-supabase-api-version',
      'x-retry-count',
      'x-cron-secret',
      'x-idempotency-key',
      'x-request-id',
      'range',
    ].join(', '),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

function b64urlJson(value: unknown): string {
  return btoa(JSON.stringify(value))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function mintPostgrestJwt(claims: Record<string, unknown>): Promise<string> {
  const secret = Deno.env.get('PGRST_JWT_SECRET');
  if (!secret) throw new Error('Missing PGRST_JWT_SECRET');

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const now = Math.floor(Date.now() / 1000);
  const header = b64urlJson({ alg: 'HS256', typ: 'JWT' });
  const payload = b64urlJson({
    iss: 'unithery-api',
    iat: now,
    exp: now + 3600,
    ...claims,
  });

  const data = new TextEncoder().encode(`${header}.${payload}`);
  const sig = await crypto.subtle.sign('HMAC', key, data);
  const signature = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${header}.${payload}.${signature}`;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function b64urlToBytes(value: string): Uint8Array {
  const pad = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = pad + '='.repeat((4 - (pad.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function verifyHs256(token: string, secret: string): Promise<Record<string, unknown>> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('malformed');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const ok = await crypto.subtle.verify(
    'HMAC',
    key,
    b64urlToBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!ok) throw new Error('bad signature');
  const payload = decodeJwtPayload(token);
  if (!payload) throw new Error('bad payload');
  return payload;
}

async function isServiceBypassToken(token: string): Promise<boolean> {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (serviceKey && token === serviceKey) return true;
  const secret = Deno.env.get('PGRST_JWT_SECRET');
  if (!secret) return false;
  try {
    const payload = await verifyHs256(token, secret);
    return payload.role === 'service_role' || payload.role === 'unithery_app';
  } catch {
    return false;
  }
}

function bearerToken(req: Request): string | null {
  const header = req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  return token || null;
}

async function mintUserPostgrestJwt(req: Request): Promise<string> {
  const token = bearerToken(req);
  if (!token) {
    throw new UnauthorizedError('Missing or invalid Authorization header');
  }
  if (await isServiceBypassToken(token)) {
    return mintPostgrestJwt({ role: 'unithery_app' });
  }
  const user = await authenticateRequest(req);
  return mintPostgrestJwt({
    role: 'authenticated',
    sub: user.id,
    email: user.email,
    clinic_id: user.clinic_id,
    is_solo: user.is_solo,
    app_metadata: {
      role: user.role,
      clinic_id: user.clinic_id,
      is_solo: user.is_solo,
    },
  });
}

async function proxyTo(
  req: Request,
  targetBase: string,
  pathPrefix: string,
  opts?: { replaceAuth?: string; stripPrefix?: boolean },
): Promise<Response> {
  const url = new URL(req.url);
  // Auth/Storage Supabase: path completo. PostgREST local: strip /rest/v1 → /patients
  let upstreamPath: string;
  if (opts?.stripPrefix) {
    upstreamPath = url.pathname.startsWith(pathPrefix)
      ? (url.pathname.slice(pathPrefix.length) || '/')
      : url.pathname;
  } else {
    upstreamPath = url.pathname.startsWith(pathPrefix)
      ? url.pathname
      : `${pathPrefix}${url.pathname}`;
  }
  const target = new URL(
    upstreamPath + url.search,
    targetBase.endsWith('/') ? targetBase : `${targetBase}/`,
  );

  const headers = new Headers(req.headers);
  headers.delete('host');
  if (opts?.replaceAuth) {
    headers.set('Authorization', `Bearer ${opts.replaceAuth}`);
  }

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: 'manual',
  };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.arrayBuffer();
  }

  const upstream = await fetch(target, init);
  const outHeaders = new Headers(upstream.headers);
  for (const [k, v] of Object.entries(corsHeaders(req))) {
    outHeaders.set(k, v);
  }
  return new Response(upstream.body, {
    status: upstream.status,
    headers: outHeaders,
  });
}

const PATH_ALIASES: Record<string, string> = {
  '/api/billing/patient-checkout': 'create-patient-checkout',
  '/api/billing/patient-cancel': 'cancel-patient-subscription',
};

function parseFunctionName(pathname: string): string | null {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (PATH_ALIASES[normalized]) return PATH_ALIASES[normalized];

  const patterns = [
    /^\/functions\/v1\/([^/]+)\/?$/,
    /^\/api\/([^/]+)\/?$/,
    /^\/v1\/([^/]+)\/?$/,
  ];
  for (const re of patterns) {
    const m = pathname.match(re);
    if (m) return m[1];
  }
  return null;
}

await loadAllFunctions();

Deno.serve({ port: Number(Deno.env.get('PORT') ?? 8080) }, async (req) => {
  const url = new URL(req.url);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  if (url.pathname === '/health' || url.pathname === '/') {
    return Response.json({
      ok: true,
      service: 'unithery-api',
      handlers: listHandlers().length,
    }, { headers: corsHeaders(req) });
  }

  // Auth e Storage 100% GCP — sem proxy para Supabase hosted.
  // Auth: Identity Platform (JWT validado em _shared/auth.ts)
  // Storage: GCS signed URLs (object-storage.ts)

  // Proxy REST → PostgREST (Cloud SQL). Strip /rest/v1: PostgREST serve em /.
  const postgrestUrl = Deno.env.get('POSTGREST_URL');
  if (postgrestUrl && url.pathname.startsWith('/rest/v1')) {
    try {
      const jwt = await mintUserPostgrestJwt(req);
      return proxyTo(req, postgrestUrl, '/rest/v1', {
        replaceAuth: jwt,
        stripPrefix: true,
      });
    } catch (err) {
      const status = err instanceof UnauthorizedError ? 401 : 500;
      return Response.json({
        error: status === 401 ? 'UNAUTHORIZED' : 'INTERNAL',
        message: err instanceof Error ? err.message : 'REST proxy failed',
      }, { status, headers: corsHeaders(req) });
    }
  }

  const fn = parseFunctionName(url.pathname);
  if (!fn) {
    return Response.json({ error: 'NOT_FOUND', path: url.pathname }, {
      status: 404,
      headers: corsHeaders(req),
    });
  }

  const handler = getHandler(fn);
  if (!handler) {
    return Response.json({ error: 'FUNCTION_NOT_LOADED', name: fn }, {
      status: 404,
      headers: corsHeaders(req),
    });
  }

  try {
    return await handler(req);
  } catch (err) {
    console.error(`[router] ${fn}`, err);
    return Response.json({
      error: 'INTERNAL',
      message: err instanceof Error ? err.message : 'unknown',
    }, { status: 500, headers: corsHeaders(req) });
  }
});
