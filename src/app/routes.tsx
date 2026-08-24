import { lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ProtectedRoute } from '@shared/ui/ProtectedRoute';
import { AppLayout } from '@shared/ui/AppLayout';
import { PortalLayout } from '@shared/ui/PortalLayout';
import { LEGACY_PORTAL_REDIRECTS } from '@shared/lib/portal-nav';

// Lazy-loaded containers
const LandingPageContainer = lazy(() => import('@containers/landing/LandingPageContainer'));
const LoginContainer = lazy(() => import('@containers/auth/LoginContainer'));
const AuthConfirmContainer = lazy(() => import('@containers/auth/AuthConfirmContainer'));
const ForgotPasswordContainer = lazy(() => import('@containers/auth/ForgotPasswordContainer'));
const ResetPasswordContainer = lazy(() => import('@containers/auth/ResetPasswordContainer'));
const RegisterClinicContainer = lazy(() => import('@containers/auth/RegisterClinicContainer'));
const InviteContainer = lazy(() => import('@containers/auth/InviteContainer'));
const DashboardContainer = lazy(() => import('@containers/dashboard/DashboardContainer'));
const PatientListContainer = lazy(() => import('@containers/patient/PatientListContainer'));
const PatientRecordContainer = lazy(() => import('@containers/patient/PatientRecordContainer'));
const ProfessionalsContainer = lazy(() => import('@containers/admin/ProfessionalsContainer'));
const RegisterFamily = lazy(() => import('@containers/portal/RegisterFamily'));
const LinkInvite = lazy(() => import('@containers/portal/LinkInvite'));
const SmartDiary = lazy(() => import('@containers/portal/SmartDiary'));
const FamilyCalendar = lazy(() => import('@containers/portal/FamilyCalendar'));
const Agreements = lazy(() => import('@containers/portal/Agreements'));
const PortalCompanion = lazy(() => import('@containers/portal/PortalCompanion'));
const SettingsHubContainer = lazy(() => import('@containers/settings/SettingsHubContainer'));
const SettingsContainer = lazy(() => import('@containers/settings/SettingsContainer'));
const StripeTestPageContainer = lazy(() => import('@containers/billing/stripe-test/StripeTestPageContainer'));
const CheckoutReturnContainer = lazy(() => import('@containers/billing/CheckoutReturnContainer'));
const FullCalendar = lazy(() => import('@containers/calendar/FullCalendar'));
const FinanceiroContainer = lazy(() => import('@containers/financeiro/FinanceiroContainer'));
const HelpContactContainer = lazy(() => import('@containers/help/HelpContactContainer'));
const TherapistCopilotContainer = lazy(() => import('@containers/copilot-workspace/TherapistCopilotContainer'));
const TherapistSessionContainer = lazy(() => import('@containers/session-workspace/TherapistSessionContainer'));

/**
 * Wrapper that adds AppLayout (persistent sidebar) to protected routes
 */
function WithLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}

function RedirectToSettings() {
  const { search } = useLocation();
  return <Navigate to={`/settings${search}`} replace />;
}

/**
 * Wrapper do Portal Unithery (PWA mobile-first com bottom nav reativa)
 */
function WithPortalLayout({ children }: { children: React.ReactNode }) {
  return <PortalLayout>{children}</PortalLayout>;
}


export function AppRoutes() {
  return (
    <Routes>
      {/* Public routes (no sidebar) */}
      <Route path="/login" element={<LoginContainer />} />
      <Route path="/auth/confirm" element={<AuthConfirmContainer />} />
      <Route path="/forgot-password" element={<ForgotPasswordContainer />} />
      <Route path="/reset-password" element={<ResetPasswordContainer />} />
      <Route path="/register" element={<RegisterClinicContainer />} />
      <Route path="/portal/register" element={<RegisterFamily />} />
      <Route path="/family/register" element={<RegisterFamily />} />
      <Route path="/ajuda" element={<HelpContactContainer />} />

      {/* Rota oculta — sem link na navegação; acesso direto pela URL */}
      <Route path="/unithery/teste" element={<StripeTestPageContainer />} />

      <Route
        path="/checkout/return"
        element={
          <ProtectedRoute>
            <CheckoutReturnContainer />
          </ProtectedRoute>
        }
      />

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
        path="/financeiro"
        element={
          <ProtectedRoute allowedRoles={['professional', 'master']} financeOnly>
            <WithLayout><FinanceiroContainer /></WithLayout>
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
            <WithLayout><TherapistCopilotContainer /></WithLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/copilot/:patientId"
        element={
          <ProtectedRoute allowedRoles={['professional']}>
            <WithLayout><TherapistCopilotContainer /></WithLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/session"
        element={
          <ProtectedRoute allowedRoles={['professional']}>
            <WithLayout><TherapistSessionContainer /></WithLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/session/:patientId"
        element={
          <ProtectedRoute allowedRoles={['professional']}>
            <WithLayout><TherapistSessionContainer /></WithLayout>
          </ProtectedRoute>
        }
      />
      {/* Portal Unithery (PWA mobile-first) — cuidador ou paciente, mesmas rotas */}
      <Route
        path="/portal/link"
        element={
          <ProtectedRoute allowedRoles={['family']}>
            <LinkInvite />
          </ProtectedRoute>
        }
      />
      <Route
        path="/portal/diary"
        element={
          <ProtectedRoute allowedRoles={['family']}>
            <WithPortalLayout><SmartDiary /></WithPortalLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/portal/calendar"
        element={
          <ProtectedRoute allowedRoles={['family']}>
            <WithPortalLayout><FamilyCalendar /></WithPortalLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/portal/agreements"
        element={
          <ProtectedRoute allowedRoles={['family']}>
            <WithPortalLayout><Agreements /></WithPortalLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/portal/ivy"
        element={
          <ProtectedRoute allowedRoles={['family']}>
            <WithPortalLayout><PortalCompanion /></WithPortalLayout>
          </ProtectedRoute>
        }
      />
      {/*
        Rotas antigas preservadas: há PWA instalado com `/family/diary` como start_url e
        e-mails de convite já enviados apontando para cá. Redirecionar custa nada; quebrar
        o atalho de quem já usa o app custa uma reinstalação.
      */}
      <Route path="/family/link" element={<Navigate to="/portal/link" replace />} />
      {LEGACY_PORTAL_REDIRECTS.map(({ from, to }) => (
        <Route key={from} path={from} element={<Navigate to={to} replace />} />
      ))}
      <Route path="/billing" element={<RedirectToSettings />} />
      <Route path="/billing/invoices" element={<RedirectToSettings />} />
      <Route path="/settings/invoices" element={<RedirectToSettings />} />
      <Route path="/settings/plan" element={<RedirectToSettings />} />
      <Route path="/assinatura" element={<RedirectToSettings />} />
      <Route
        path="/settings"
        element={
          <ProtectedRoute ownerOnly>
            <WithLayout><SettingsHubContainer /></WithLayout>
          </ProtectedRoute>
        }
      >
        <Route index element={<SettingsContainer />} />
      </Route>
      <Route
        path="/invite"
        element={
          <ProtectedRoute>
            <InviteContainer />
          </ProtectedRoute>
        }
      />

      {/* Landing page pública — porta de entrada da Unithery */}
      <Route path="/" element={<LandingPageContainer />} />

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
