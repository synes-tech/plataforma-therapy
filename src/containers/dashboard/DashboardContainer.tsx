import { Navigate } from 'react-router-dom';
import { useAuth } from '@shared/hooks/useAuth';
import { ClinicAdminDashboard } from '@features/dashboard/ClinicAdminDashboard';
import { ProfessionalDashboard } from './ProfessionalDashboard';

export default function DashboardContainer() {
  const { user } = useAuth();

  if (user?.role === 'family') {
    return <Navigate to="/family/diary" replace />;
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
    <div className="bg-[#F8FAF9] p-6 lg:p-8">
      <header className="mb-8">
        <h1 className="font-serif text-2xl font-medium tracking-tight text-charcoal">
          Olá, {email?.split('@')[0]}
        </h1>
        <p className="mt-1 text-sm text-charcoal-muted">Resumo da sua plataforma</p>
      </header>

      <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <p className="text-sm text-charcoal-muted">
          Perfil: <span className="font-medium text-charcoal">{role ? roleLabels[role] : '-'}</span>
        </p>
        {role === 'professional' && (
          <a href="/patients" className="btn-primary mt-4 inline-flex">Ver Pacientes</a>
        )}
        {role === 'family' && (
          <a href="/diary" className="btn-primary mt-4 inline-flex bg-mint hover:bg-mint-dark">Preencher Diário</a>
        )}
        {role === 'master' && (
          <p className="mt-2 text-xs text-charcoal-muted">Painel Master em desenvolvimento.</p>
        )}
      </div>
    </div>
  );
}
