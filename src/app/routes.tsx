import { lazy } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { ProtectedRoute } from '@shared/ui/ProtectedRoute';
import { AppLayout } from '@shared/ui/AppLayout';
import { FamilyLayout } from '@shared/ui/FamilyLayout';

// Lazy-loaded containers
const LoginContainer = lazy(() => import('@containers/auth/LoginContainer'));
const RegisterClinicContainer = lazy(() => import('@containers/auth/RegisterClinicContainer'));
const InviteContainer = lazy(() => import('@containers/auth/InviteContainer'));
const DashboardContainer = lazy(() => import('@containers/dashboard/DashboardContainer'));
const PatientListContainer = lazy(() => import('@containers/patient/PatientListContainer'));
const PatientRecordContainer = lazy(() => import('@containers/patient/PatientRecordContainer'));
const ProfessionalsContainer = lazy(() => import('@containers/admin/ProfessionalsContainer'));
const SessionContainer = lazy(() => import('@containers/patient/SessionContainer'));
const RegisterFamily = lazy(() => import('@containers/family/RegisterFamily'));
const LinkInvite = lazy(() => import('@containers/family/LinkInvite'));
const RoutineDiary = lazy(() => import('@containers/family/RoutineDiary'));
const FamilyCalendar = lazy(() => import('@containers/family/FamilyCalendar'));
const Agreements = lazy(() => import('@containers/family/Agreements'));
const BillingHubContainer = lazy(() => import('@containers/billing/BillingHubContainer'));
const PlanControlContainer = lazy(() => import('@containers/billing/PlanControlContainer'));
const BillingContainer = lazy(() => import('@containers/billing/BillingContainer'));
const SettingsContainer = lazy(() => import('@containers/settings/SettingsContainer'));
const FullCalendar = lazy(() => import('@containers/calendar/FullCalendar'));

/**
 * Wrapper that adds AppLayout (persistent sidebar) to protected routes
 */
function WithLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}

/**
 * Wrapper for the Family Portal (mobile-first PWA shell with bottom nav)
 */
function WithFamilyLayout({ children }: { children: React.ReactNode }) {
  return <FamilyLayout>{children}</FamilyLayout>;
}

function CopilotLegacyRedirect() {
  const { patientId } = useParams<{ patientId: string }>();
  return <Navigate to={`/patients/${patientId}/copilot`} replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      {/* Public routes (no sidebar) */}
      <Route path="/login" element={<LoginContainer />} />
      <Route path="/register" element={<RegisterClinicContainer />} />
      <Route path="/family/register" element={<RegisterFamily />} />

      {/* Protected routes with persistent sidebar */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <WithLayout><DashboardContainer /></WithLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/professionals"
        element={
          <ProtectedRoute allowedRoles={['clinic_admin', 'master']}>
            <WithLayout><ProfessionalsContainer /></WithLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/patients/archive"
        element={
          <ProtectedRoute allowedRoles={['professional', 'clinic_admin', 'master']}>
            <WithLayout><PatientListContainer /></WithLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/patients"
        element={
          <ProtectedRoute allowedRoles={['professional', 'clinic_admin', 'master']}>
            <WithLayout><PatientListContainer /></WithLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/patients/:patientId/:tab?"
        element={
          <ProtectedRoute allowedRoles={['professional', 'clinic_admin', 'master']}>
            <WithLayout><PatientRecordContainer /></WithLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/calendar"
        element={
          <ProtectedRoute allowedRoles={['professional']}>
            <WithLayout><FullCalendar /></WithLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/agenda"
        element={
          <ProtectedRoute allowedRoles={['professional']}>
            <WithLayout><FullCalendar /></WithLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute allowedRoles={['professional']}>
            <Navigate to="/patients" replace />
          </ProtectedRoute>
        }
      />
      <Route
        path="/copilot"
        element={
          <ProtectedRoute allowedRoles={['professional']}>
            <Navigate to="/patients" replace />
          </ProtectedRoute>
        }
      />
      <Route
        path="/session/:patientId"
        element={
          <ProtectedRoute allowedRoles={['professional']}>
            <WithLayout><SessionContainer /></WithLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/copilot/:patientId"
        element={
          <ProtectedRoute allowedRoles={['professional']}>
            <CopilotLegacyRedirect />
          </ProtectedRoute>
        }
      />
      {/* Family Portal (PWA mobile-first) */}
      <Route
        path="/family/link"
        element={
          <ProtectedRoute allowedRoles={['family']}>
            <LinkInvite />
          </ProtectedRoute>
        }
      />
      <Route
        path="/family/diary"
        element={
          <ProtectedRoute allowedRoles={['family']}>
            <WithFamilyLayout><RoutineDiary /></WithFamilyLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/family/calendar"
        element={
          <ProtectedRoute allowedRoles={['family']}>
            <WithFamilyLayout><FamilyCalendar /></WithFamilyLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/family/agreements"
        element={
          <ProtectedRoute allowedRoles={['family']}>
            <WithFamilyLayout><Agreements /></WithFamilyLayout>
          </ProtectedRoute>
        }
      />
      {/* Legacy diary route → new portal */}
      <Route path="/diary" element={<Navigate to="/family/diary" replace />} />
      <Route
        path="/billing"
        element={
          <ProtectedRoute ownerOnly>
            <WithLayout><BillingHubContainer /></WithLayout>
          </ProtectedRoute>
        }
      >
        <Route index element={<PlanControlContainer />} />
        <Route path="invoices" element={<BillingContainer />} />
      </Route>
      <Route
        path="/settings"
        element={
          <ProtectedRoute ownerOnly>
            <WithLayout><SettingsContainer /></WithLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/invite"
        element={
          <ProtectedRoute>
            <InviteContainer />
          </ProtectedRoute>
        }
      />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* 404 */}
      <Route
        path="*"
        element={
          <div className="flex min-h-dvh flex-col items-center justify-center bg-ice-light">
            <h1 className="font-display text-2xl font-bold text-charcoal">404</h1>
            <p className="mt-2 text-charcoal-muted">Página não encontrada</p>
          </div>
        }
      />
    </Routes>
  );
}
