import { Navigate } from 'react-router-dom';
import { useAuth } from '@shared/hooks/useAuth';
import { isClinicOwner } from '@shared/lib/roles';
import type { UserRole } from '@shared/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  ownerOnly?: boolean;
}

export function ProtectedRoute({ children, allowedRoles, ownerOnly }: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (ownerOnly && !isClinicOwner(user)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
