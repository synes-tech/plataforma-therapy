import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PageLoader } from '@containers/loading';
import { callFunction } from '@shared/lib/api';
import { getFirstName, getTimeGreeting } from '@shared/lib/greeting';
import { ClinicAdminPulse } from './ClinicAdminPulse';
import { ClinicAdminTeam } from './ClinicAdminTeam';
import { DashboardHeaderTools } from './DashboardHeaderTools';
import { DashboardHero } from './DashboardHero';
import { buildClinicDashboardNotifications } from './dashboard-notifications.utils';
import type { ClinicDashboardData } from './dashboard.types';
import { formatLongDate } from './home.utils';
import { PageHeader } from '@containers/layout';
import { useAcknowledgeClinicalAlert, useClinicalAlerts } from './useClinicalAlerts';

export function ClinicAdminDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['clinic-dashboard'],
    queryFn: () => callFunction<ClinicDashboardData>('get-clinic-dashboard', {}),
  });
  const { data: alertsData, error: alertsError } = useClinicalAlerts();
  const acknowledge = useAcknowledgeClinicalAlert();
  const [removingIds, setRemovingIds] = useState<Set<string>>(() => new Set());

  const firstName = getFirstName(data?.admin_name ?? 'Admin');
  const pending = (data?.pending_family_links ?? 0) + (data?.crisis_alerts_count ?? 0);
  const notifications = useMemo(
    () =>
      buildClinicDashboardNotifications({
        clinicalAlerts: alertsData?.alerts ?? [],
        pendingFamilyLinks: data?.pending_family_links ?? 0,
        team: data?.team_today ?? [],
      }),
    [alertsData?.alerts, data?.pending_family_links, data?.team_today],
  );

  function handleAcknowledge(alertId: string) {
    setRemovingIds((prev) => new Set(prev).add(alertId));
    window.setTimeout(() => {
      acknowledge.mutate(alertId, {
        onError: () => {
          setRemovingIds((prev) => {
            const next = new Set(prev);
            next.delete(alertId);
            return next;
          });
        },
      });
    }, 280);
  }

  const headerTools = (
    <DashboardHeaderTools
      notifications={notifications}
      alertsError={Boolean(alertsError)}
      onAcknowledge={handleAcknowledge}
      acknowledgingId={acknowledge.isPending ? (acknowledge.variables ?? null) : null}
      removingIds={removingIds}
    />
  );

  if (isLoading && !data) {
    return <PageLoader label="Carregando painel da clínica..." className="min-h-[60vh]" />;
  }

  return (
    <div className="min-h-full bg-[#F8FAF9] px-4 sm:px-6 lg:px-8">
      <PageHeader
        className="hidden lg:block"
        title={<DashboardHero compact firstName={firstName} greeting={getTimeGreeting()} />}
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/patients"
              className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-charcoal hover:border-primary/30 hover:text-primary"
            >
              Pacientes
            </Link>
            <Link
              to="/professionals"
              className="inline-flex h-9 items-center rounded-xl bg-charcoal px-3 text-xs font-medium text-white hover:bg-charcoal-light"
            >
              Novo profissional
            </Link>
            {headerTools}
          </div>
        }
      />
      <div className="mt-4 space-y-6 pb-6 sm:mt-6 lg:mt-8 lg:pb-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between lg:hidden">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <DashboardHero
              firstName={firstName}
              greeting={getTimeGreeting()}
              meta={`${formatLongDate('')}${data?.clinic_name ? ` · ${data.clinic_name}` : ''}`}
              subtitle={
                pending > 0
                  ? `${pending} pendência${pending === 1 ? '' : 's'} na operação da clínica.`
                  : 'Operação da clínica em dia.'
              }
            />
            {headerTools}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/patients"
              className="inline-flex h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-charcoal hover:border-primary/30 hover:text-primary"
            >
              Pacientes
            </Link>
            <Link
              to="/professionals"
              className="inline-flex h-11 items-center rounded-xl bg-charcoal px-4 text-sm font-medium text-white hover:bg-charcoal-light"
            >
              Novo profissional
            </Link>
          </div>
        </header>

        {error ? (
          <div role="alert" className="rounded-xl border border-error/10 bg-error-light/50 px-4 py-3 text-sm text-error">
            Não foi possível carregar os dados do painel. Tente novamente.
          </div>
        ) : null}

        <ClinicAdminPulse data={data} loading={isLoading} />
        <ClinicAdminTeam
          team={data?.team_today ?? []}
          week={data?.week_by_professional ?? []}
          loading={isLoading}
        />
      </div>
    </div>
  );
}
