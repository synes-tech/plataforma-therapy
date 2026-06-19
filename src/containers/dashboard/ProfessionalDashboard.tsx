import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@containers/layout';
import { PageLoader } from '@containers/loading';
import { callFunction } from '@shared/lib/api';
import { getFirstName, getGreetingEmoji, getTimeGreeting } from '@shared/lib/greeting';
import { DashboardQuickStats } from './DashboardQuickStats';
import { DashboardAgendaCard } from './DashboardAgendaCard';
import { DashboardAlertsCard } from './DashboardAlertsCard';
import { briefingSubtitle } from './dashboard.utils';
import type { BriefingData } from './dashboard.types';

function PlusIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

export function ProfessionalDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['professional-briefing'],
    queryFn: () => callFunction<BriefingData>('get-professional-morning-briefing', {}),
  });

  const schedule = data?.schedule ?? [];
  const alerts = data?.alerts ?? [];
  const greeting = getTimeGreeting();
  const emoji = getGreetingEmoji();
  const firstName = getFirstName(data?.professional.name ?? 'Terapeuta');

  if (isLoading && !data) {
    return <PageLoader label="Carregando seu resumo..." className="min-h-[60vh]" />;
  }

  return (
    <div className="min-h-full bg-[#F8FAF9] px-4 sm:px-6 lg:px-8">
      <PageHeader
        title={
          <h1 className="font-serif text-2xl font-medium tracking-tight text-charcoal md:text-3xl">
            <span className="mr-2" aria-hidden>
              {emoji}
            </span>
            {greeting}, {firstName}.
          </h1>
        }
        subtitle={briefingSubtitle(data?.summary)}
        actions={
          <Link
            to="/patients"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-dark active:scale-[0.98] sm:w-auto"
          >
            <PlusIcon />
            Novo Paciente
          </Link>
        }
      />

      <div className="mt-6 space-y-6 lg:mt-8">
        <DashboardQuickStats summary={data?.summary} loading={isLoading} />

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-error/10 bg-error-light/50 px-4 py-3 text-sm text-error"
          >
            Não foi possível carregar seu resumo de hoje. Tente novamente.
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
          <DashboardAgendaCard schedule={schedule} loading={isLoading} />
          <DashboardAlertsCard alerts={alerts} loading={isLoading} />
        </div>
      </div>
    </div>
  );
}
