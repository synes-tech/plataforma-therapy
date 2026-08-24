import { Navigate } from 'react-router-dom';
import { useAuth } from '@shared/hooks/useAuth';
import { PageHeader } from '@containers/layout';
import { ClinicAdminDashboard } from './ClinicAdminDashboard';
import { ProfessionalDashboard } from './ProfessionalDashboard';

export default function DashboardContainer() {
  const { user } = useAuth();

  if (user?.role === 'family') {
    return <Navigate to="/portal/diary" replace />;
  }

  if (user?.role === 'clinic_admin') {
    return <ClinicAdminDashboard />;
  }

  if (user?.role === 'professional') {
    return <ProfessionalDashboard />;
  }

  return <LegacyDashboard role={user?.role} email={user?.email} />;
}

function LegacyDashboard({ role, email }: { role?: string; email?: string }) {
  const roleLabels: Record<string, string> = {
    master: 'Administrador Master',
    clinic_admin: 'Admin da Clínica',
    professional: 'Profissional',
    family: 'Família',
  };

  return (
    <div className="bg-[#F8FAF9] px-4 sm:px-6 lg:px-8">
      <PageHeader title={`Olá, ${email?.split('@')[0] ?? ''}`} subtitle="Resumo da sua plataforma" />

      <div className="py-6">
        <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <p className="text-sm text-charcoal-muted">
            Perfil: <span className="font-medium text-charcoal">{role ? roleLabels[role] : '-'}</span>
          </p>
          {role === 'master' && (
            <p className="mt-2 text-xs text-charcoal-muted">Painel Master em desenvolvimento.</p>
          )}
        </div>
      </div>
    </div>
  );
}
