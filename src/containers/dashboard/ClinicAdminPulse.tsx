import { DashboardKpiCard } from './DashboardKpiCard';
import type { ClinicDashboardData } from './dashboard.types';

interface ClinicAdminPulseProps {
  data?: ClinicDashboardData;
  loading?: boolean;
}

export function ClinicAdminPulse({ data, loading }: ClinicAdminPulseProps) {
  const occupancy = data?.occupancy_pct ?? 0;
  const pendingFamily = data?.pending_family_links ?? 0;
  const crises = data?.crisis_alerts_count ?? 0;

  return (
    <section aria-label="Pulso da clínica" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <DashboardKpiCard
        label="Sessões hoje"
        value={String(data?.sessions_today ?? 0)}
        hint="Em toda a equipe"
        to="/calendar"
        ariaLabel="Abrir agenda da clínica"
        loading={loading}
      />
      <DashboardKpiCard
        label="Ocupação da semana"
        value={`${occupancy}%`}
        hint={`${data?.professionals_count ?? 0} / ${data?.max_professionals ?? 0} profissionais`}
        to="/professionals"
        ariaLabel="Ver profissionais da clínica"
        loading={loading}
      />
      <DashboardKpiCard
        label="Famílias sem app"
        value={String(pendingFamily)}
        hint={pendingFamily === 0 ? 'Todos os pacientes vinculados' : 'Convites ainda pendentes'}
        tone={pendingFamily > 0 ? 'alert' : 'default'}
        to="/patients"
        ariaLabel="Ver pacientes sem família"
        loading={loading}
      />
      <DashboardKpiCard
        label="Crises na semana"
        value={String(crises)}
        hint={`${data?.ai_reports_this_month ?? 0} relatórios de IA no mês`}
        tone={crises > 0 ? 'alert' : 'mint'}
        to="/patients"
        ariaLabel="Ver pacientes com alertas"
        loading={loading}
      />
    </section>
  );
}
