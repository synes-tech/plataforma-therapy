import type { AuthenticatedUser } from '@shared/types';

/**
 * A "clinic owner" can access billing and settings:
 * master, clinic_admin, or a solo professional (consultório).
 * Regular professionals (clinic employees) are NOT owners.
 */
export function isClinicOwner(user: Pick<AuthenticatedUser, 'role' | 'is_solo'> | null): boolean {
  if (!user) return false;
  return (
    user.role === 'master' ||
    user.role === 'clinic_admin' ||
    (user.role === 'professional' && user.is_solo)
  );
}
