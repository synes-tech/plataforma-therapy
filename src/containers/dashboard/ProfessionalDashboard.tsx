import { useQuery } from '@tanstack/react-query';
import { PageLoader } from '@containers/loading';
import { callFunction } from '@shared/lib/api';
import { DashboardHero } from './DashboardHero';
import { DashboardQuickStats } from './DashboardQuickStats';
import { DashboardAgendaCard } from './DashboardAgendaCard';
import { DashboardAlertsCard } from './DashboardAlertsCard';
import type { BriefingData } from './dashboard.types';

export function ProfessionalDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['professional-briefing'],
    queryFn: () => callFunction<BriefingData>('get-professional-morning-briefing', {}),
  });

  const schedule = data?.schedule ?? [];
  const alerts = data?.alerts ?? [];

  if (isLoading && !data) {
    return <PageLoader label="Carregando seu resumo..." className="min-h-[60vh]" />;
  }

  return (
    <div className="min-h-full bg-gray-50 px-5 py-6 lg:px-8 lg:py-8">
      <DashboardHero professionalName={data?.professional.name ?? ''} summary={data?.summary} />

      <DashboardQuickStats summary={data?.summary} loading={isLoading} />

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-error/10 bg-error-light/50 px-4 py-3 text-sm text-error"
        >
          Não foi possível carregar seu resumo de hoje. Tente novamente.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
        <DashboardAgendaCard schedule={schedule} loading={isLoading} />
        <DashboardAlertsCard alerts={alerts} loading={isLoading} />
      </div>
    </div>
  );
}
