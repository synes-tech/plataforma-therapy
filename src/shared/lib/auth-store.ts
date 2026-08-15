import { create } from 'zustand';
import {
  getFirebaseCurrentUser,
  getFirebaseIdToken,
  isFirebaseAuthConfigured,
  signInWithGooglePopup,
  signOutFirebase,
  subscribeFirebaseAuth,
} from './firebase';
import {
  completeMfaSignIn,
  isMfaRequiredError,
  mapFirebaseAuthError,
  signInWithEmailFirebase,
  type MfaRequiredError,
} from './firebase-mfa';
import type { MultiFactorResolver } from 'firebase/auth';
import type { AuthenticatedUser, UserRole } from '@shared/types';
import { callPublicFunction } from './api';

interface AuthState {
  user: AuthenticatedUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  initialized: boolean;
  authProvider: 'firebase' | null;
  pendingMfaResolver: MultiFactorResolver | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  hydrateFromFirebase: () => Promise<void>;
  completeMfaLogin: (verificationId: string, code: string) => Promise<void>;
  clearPendingMfa: () => void;
  logout: () => Promise<void>;
  initialize: () => void;
}

async function extractUserFromFirebase(user: {
  uid: string;
  email: string | null;
  getIdTokenResult: (forceRefresh?: boolean) => Promise<{ claims: Record<string, unknown> }>;
}): Promise<AuthenticatedUser> {
  const token = await user.getIdTokenResult(true);
  const claims = token.claims;
  const role = (claims.role as UserRole | undefined)
    ?? ((claims.app_metadata as Record<string, unknown> | undefined)?.role as UserRole | undefined)
    ?? 'family';
  const clinicRaw = claims.clinic_id
    ?? (claims.app_metadata as Record<string, unknown> | undefined)?.clinic_id
    ?? null;
  const isSolo = claims.is_solo === true
    || (claims.app_metadata as Record<string, unknown> | undefined)?.is_solo === true;

  if (!claims.role && !(claims.app_metadata as Record<string, unknown> | undefined)?.role) {
    throw new Error(
      'Esta conta Google ainda não está vinculada à Unithery. Entre com e-mail e senha ou peça acesso ao administrador.',
    );
  }

  return {
    id: user.uid,
    email: user.email ?? '',
    role,
    clinic_id: typeof clinicRaw === 'string' ? clinicRaw : null,
    is_solo: isSolo,
  };
}

async function applyFirebaseSession(
  set: (partial: Partial<AuthState>) => void,
  firebaseUser: Parameters<typeof extractUserFromFirebase>[0],
) {
  const user = await extractUserFromFirebase(firebaseUser);
  set({
    user,
    isAuthenticated: true,
    isLoading: false,
    authProvider: 'firebase',
    pendingMfaResolver: null,
  });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  initialized: false,
  authProvider: null,
  pendingMfaResolver: null,

  login: async (email: string, password: string) => {
    if (!isFirebaseAuthConfigured()) {
      throw new Error('Identity Platform não configurado neste ambiente.');
    }

    const timeout = setTimeout(() => undefined, 10000);

    try {
      await callPublicFunction('guard-auth-rate', {
        action: 'login',
        email: email.trim().toLowerCase(),
      });
      const cred = await signInWithEmailFirebase(email, password);
      clearTimeout(timeout);
      await applyFirebaseSession(set, cred.user);
    } catch (err) {
      clearTimeout(timeout);
      if (isMfaRequiredError(err)) {
        set({ pendingMfaResolver: err.resolver });
        throw err;
      }
      if (err instanceof Error && (err as Error & { code?: string }).code === 'RATE_LIMITED') {
        throw err;
      }
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Tempo limite excedido. Verifique sua conexão.');
      }
      throw new Error(mapFirebaseAuthError(err));
    }
  },

  loginWithGoogle: async () => {
    if (!isFirebaseAuthConfigured()) {
      throw new Error('Login com Google ainda não está disponível neste ambiente.');
    }

    try {
      const firebaseUser = await signInWithGooglePopup();
      await applyFirebaseSession(set, firebaseUser);
    } catch (err) {
      if (isMfaRequiredError(err)) {
        set({ pendingMfaResolver: (err as MfaRequiredError).resolver });
        throw err;
      }
      await signOutFirebase().catch(() => undefined);
      if (err && typeof err === 'object' && 'code' in err) {
        const code = String((err as { code: string }).code);
        if (code === 'auth/account-exists-with-different-credential') {
          throw new Error(
            'Já existe uma conta com este e-mail. Entre com e-mail e senha e vincule o Google nas configurações.',
          );
        }
      }
      throw new Error(mapFirebaseAuthError(err));
    }
  },

  hydrateFromFirebase: async () => {
    const firebaseUser = getFirebaseCurrentUser();
    if (!firebaseUser) {
      throw new Error('Sessão Google expirada. Tente novamente.');
    }
    await firebaseUser.getIdToken(true);
    await applyFirebaseSession(set, firebaseUser);
  },

  completeMfaLogin: async (verificationId: string, code: string) => {
    const resolver = get().pendingMfaResolver;
    if (!resolver) {
      throw new Error('Sessão MFA expirada. Faça login novamente.');
    }
    try {
      const cred = await completeMfaSignIn(resolver, verificationId, code);
      await applyFirebaseSession(set, cred.user);
    } catch (err) {
      throw new Error(mapFirebaseAuthError(err));
    }
  },

  clearPendingMfa: () => {
    set({ pendingMfaResolver: null });
  },

  logout: async () => {
    await signOutFirebase().catch(() => undefined);
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      authProvider: null,
      pendingMfaResolver: null,
    });
  },

  initialize: () => {
    if (get().initialized) return;
    set({ initialized: true });

    if (!isFirebaseAuthConfigured()) {
      set({ user: null, isAuthenticated: false, isLoading: false, authProvider: null });
      return;
    }

    subscribeFirebaseAuth((firebaseUser) => {
      if (!firebaseUser) {
        set({ user: null, isAuthenticated: false, isLoading: false, authProvider: null });
        return;
      }
      void extractUserFromFirebase(firebaseUser)
        .then((user) => {
          set({ user, isAuthenticated: true, isLoading: false, authProvider: 'firebase' });
        })
        .catch(() => {
          if (get().authProvider === 'firebase') {
            set({ user: null, isAuthenticated: false, isLoading: false, authProvider: null });
          } else {
            set({ isLoading: false });
          }
        });
    });
  },
}));

/** Usado por auth-session / API para saber de onde tirar o Bearer token. */
export async function resolvePreferredAccessToken(): Promise<string | null> {
  if (!isFirebaseAuthConfigured()) return null;
  return getFirebaseIdToken();
}
