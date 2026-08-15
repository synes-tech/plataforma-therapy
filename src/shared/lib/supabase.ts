import { createClient } from '@supabase/supabase-js';
import { getFirebaseIdToken, isFirebaseAuthConfigured } from './firebase';

/** Base URL da API (Cloud Run). Nome legado VITE_SUPABASE_URL mantido por compat. */
const supabaseUrl = (import.meta.env.VITE_GCP_API_URL as string | undefined)?.replace(/\/$/, '')
  || (import.meta.env.VITE_SUPABASE_URL as string);
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const GCP_API_URL = (import.meta.env.VITE_GCP_API_URL as string | undefined)?.replace(/\/$/, '');

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_GCP_API_URL/VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
}

/** Data plane GCP: REST/Functions via Cloud Run (PostgREST + handlers). */
export function isGcpDataPlane(): boolean {
  return Boolean(GCP_API_URL && isFirebaseAuthConfigured());
}

async function gcpAwareFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const original =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url;

  const apiBase = GCP_API_URL || supabaseUrl;
  let targetUrl = original;

  // Reescreve chamadas ao host configurado para o Cloud Run quando aplicável
  if (GCP_API_URL && original.startsWith(supabaseUrl) && supabaseUrl !== GCP_API_URL) {
    targetUrl = `${GCP_API_URL}${original.slice(supabaseUrl.length)}`;
  } else if (!original.startsWith('http') && GCP_API_URL) {
    targetUrl = original;
  }

  void apiBase;

  const token = await getFirebaseIdToken().catch(() => null);
  const headers = new Headers(
    input instanceof Request ? input.headers : init?.headers,
  );
  if (token) headers.set('Authorization', `Bearer ${token}`);

  if (input instanceof Request) {
    return fetch(
      new Request(targetUrl === original ? input : targetUrl, {
        method: input.method,
        headers,
        body: input.body,
        mode: input.mode,
        credentials: input.credentials,
        cache: input.cache,
        redirect: input.redirect,
        referrer: input.referrer,
        integrity: input.integrity,
        duplex: input.body ? 'half' : undefined,
      } as RequestInit),
    );
  }

  return fetch(targetUrl, { ...init, headers });
}

/**
 * Cliente PostgREST-compat (supabase-js) apontando para Cloud Run / API GCP.
 * Auth de sessão é Identity Platform — não use supabase.auth.* para login.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
    storage: globalThis.localStorage,
  },
  global: {
    fetch: gcpAwareFetch,
  },
});
