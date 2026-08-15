import { resolvePreferredAccessToken, useAuthStore } from './auth-store';
import { getFirebaseIdToken, signOutFirebase } from './firebase';

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
 * Garante access_token Firebase válido antes de chamar a API GCP.
 */
export async function resolveAccessToken(): Promise<string> {
  const preferred = await resolvePreferredAccessToken();
  if (preferred) return preferred;

  const firebaseToken = await getFirebaseIdToken(true);
  if (firebaseToken) return firebaseToken;

  throw new AuthSessionError();
}

/** Encerra sessão local após 401 do backend. */
export async function clearAuthSession(): Promise<void> {
  await signOutFirebase().catch(() => undefined);
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    authProvider: null,
  });
}
