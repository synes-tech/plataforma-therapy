import { create } from 'zustand';
import { supabase } from './supabase';
import type { AuthenticatedUser, UserRole } from '@shared/types';

interface AuthState {
  user: AuthenticatedUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  initialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => void;
}

function extractUserFromSession(session: { user: { id: string; email?: string; app_metadata?: Record<string, unknown> } }): AuthenticatedUser {
  const { user } = session;
  return {
    id: user.id,
    email: user.email ?? '',
    role: (user.app_metadata?.role as UserRole) ?? 'family',
    clinic_id: (user.app_metadata?.clinic_id as string) ?? null,
    is_solo: user.app_metadata?.is_solo === true,
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  initialized: false,

  login: async (email: string, password: string) => {
    // Timeout protection — prevent page freeze if Supabase hangs
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s max

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      clearTimeout(timeout);

      if (error) {
        throw new Error(error.message);
      }

      if (data.session) {
        const user = extractUserFromSession(data.session);
        set({ user, isAuthenticated: true, isLoading: false });
      }
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Tempo limite excedido. Verifique sua conexão.');
      }
      throw err;
    }
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  initialize: () => {
    if (get().initialized) return;
    set({ initialized: true });

    async function applySession(session: { user: { id: string; email?: string; app_metadata?: Record<string, unknown> } } | null) {
      if (!session) {
        set({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }

      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (!refreshed.session) {
          set({ user: null, isAuthenticated: false, isLoading: false });
          return;
        }
        set({
          user: extractUserFromSession(refreshed.session),
          isAuthenticated: true,
          isLoading: false,
        });
        return;
      }

      set({
        user: extractUserFromSession(session),
        isAuthenticated: true,
        isLoading: false,
      });
    }

    void supabase.auth.getSession().then(({ data: { session } }) => applySession(session)).catch(() => {
      set({ user: null, isAuthenticated: false, isLoading: false });
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        set({
          user: extractUserFromSession(session),
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    });
  },
}));
