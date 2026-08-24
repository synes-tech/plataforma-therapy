import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageLoader } from '@containers/loading';
import { callFunction } from '@shared/lib/api';
import { useAuth } from '@shared/hooks/useAuth';
import { getFirstName, getTimeGreeting } from '@shared/lib/greeting';
import { canAccessFinance } from '@shared/lib/roles';
import type { PlanControlState } from '@containers/billing/plan-control.types';
import type { BriefingData } from './dashboard.types';
import { PageHeader } from '@containers/layout';
import { DashboardHeaderTools } from './DashboardHeaderTools';
import { DashboardHero } from './DashboardHero';
import { HomeAttendanceChart } from './HomeAttendanceChart';
import { HomeFinanceStrip } from './HomeFinanceStrip';
import { HomeKpiRow } from './HomeKpiRow';
import { HomeTodaySplit } from './HomeTodaySplit';
import { buildDashboardNotifications } from './dashboard-notifications.utils';
import { useAcknowledgeClinicalAlert, useClinicalAlerts } from './useClinicalAlerts';

export function ProfessionalDashboard() {
  const { user } = useAuth();
  const canFinance = canAccessFinance(user);
  const { data, isLoading, error } = useQuery({
    queryKey: ['professional-briefing'],
    queryFn: () => callFunction<BriefingData>('get-professional-morning-briefing', {}),
  });
  const planQuery = useQuery({
    queryKey: ['plan-control-state'],
    queryFn: () => callFunction<PlanControlState>('get-plan-control-state', {}),
  });
  const { data: alertsData, error: alertsError } = useClinicalAlerts();
  const acknowledge = useAcknowledgeClinicalAlert();
  const [removingIds, setRemovingIds] = useState<Set<string>>(() => new Set());

  const firstName = getFirstName(data?.professional.name ?? 'Terapeuta');
  const notifications = useMemo(
    () =>
      buildDashboardNotifications({
        clinicalAlerts: alertsData?.alerts ?? [],
        schedule: data?.schedule ?? [],
        briefing: data ?? null,
        canFinance,
      }),
    [alertsData?.alerts, canFinance, data],
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
    return <PageLoader label="Carregando seu resumo..." className="min-h-[60vh]" />;
  }

  return (
    <div className="min-h-full bg-[#F8FAF9] px-4 sm:px-6 lg:px-8">
      <PageHeader
        className="hidden lg:block"
        title={<DashboardHero compact firstName={firstName} greeting={getTimeGreeting()} />}
        actions={headerTools}
      />
      <div className="mt-4 space-y-6 pb-6 sm:mt-6 lg:mt-8 lg:pb-8">
        <div className="flex items-start justify-between gap-3 lg:hidden">
          <DashboardHero firstName={firstName} greeting={getTimeGreeting()} date={data?.date ?? ''} />
          {headerTools}
        </div>

        {error ? (
          <div role="alert" className="rounded-xl border border-error/10 bg-error-light/50 px-4 py-3 text-sm text-error">
            Não foi possível carregar seu resumo de hoje. Tente novamente.
          </div>
        ) : null}

        <HomeKpiRow data={data} plan={planQuery.data} loading={isLoading || planQuery.isLoading} />

        {canFinance ? <HomeFinanceStrip data={data} loading={isLoading} /> : null}

        <HomeTodaySplit
          schedule={data?.schedule ?? []}
          alerts={alertsData?.alerts ?? []}
          alertsError={Boolean(alertsError)}
          loading={isLoading}
          onAcknowledge={handleAcknowledge}
          acknowledgingId={acknowledge.isPending ? (acknowledge.variables ?? null) : null}
          removingIds={removingIds}
        />

        <HomeAttendanceChart data={data} />
      </div>
    </div>
  );
}
