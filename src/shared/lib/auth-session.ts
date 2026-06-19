import { supabase } from './supabase';
import { useAuthStore } from './auth-store';

const TOKEN_REFRESH_BUFFER_SEC = 60;

export class AuthSessionError extends Error {
  readonly code = 'UNAUTHORIZED';

  constructor(message = 'Sessão expirada. Faça login novamente.') {
    super(message);
    this.name = 'AuthSessionError';
  }
}

export function isAuthSessionError(error: unknown): boolean {
  if (error instanceof AuthSessionError) return true;
  if (error instanceof Error) {
    const code = (error as Error & { code?: string }).code;
    return code === 'UNAUTHORIZED' || error.message.includes('Sessão expirada');
  }
  return false;
}

/**
 * Garante access_token válido antes de chamar Edge Functions.
 * `getSession()` pode devolver JWT expirado do localStorage; renovamos quando necessário.
 */
export async function resolveAccessToken(): Promise<string> {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session?.access_token) {
    throw new AuthSessionError();
  }

  const expiresAt = session.expires_at ?? 0;
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresSoon = expiresAt - nowSec <= TOKEN_REFRESH_BUFFER_SEC;

  if (expiresSoon) {
    return refreshAccessToken();
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return refreshAccessToken();
  }

  return session.access_token;
}

async function refreshAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.refreshSession();

  if (error || !data.session?.access_token) {
    throw new AuthSessionError();
  }

  return data.session.access_token;
}

/** Encerra sessão local após 401 do backend. */
export async function clearAuthSession(): Promise<void> {
  await supabase.auth.signOut();
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isLoading: false,
  });
}
