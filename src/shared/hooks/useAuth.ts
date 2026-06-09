import { useEffect } from 'react';
import { useAuthStore } from '@shared/lib/auth-store';

/**
 * Hook to initialize auth on app mount and access current user state.
 * initialize() is now idempotent — safe to call multiple times.
 */
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- initialize is idempotent, runs once

  return { user, isLoading, isAuthenticated, login, logout };
}
