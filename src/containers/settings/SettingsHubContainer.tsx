import { Suspense } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@containers/layout';
import { TabPanelLoader } from '@containers/loading';
import { callFunction } from '@shared/lib/api';
import { planLabel } from '@features/billing/format';
import { SettingsHubTabs } from './SettingsHubTabs';
import { SettingsPlanBanner } from './SettingsPlanBanner';
import type { SettingsHubTab } from './settings-hub.types';

const PAGE_TITLE = 'Controle Geral';

function tabFromPath(pathname: string): SettingsHubTab {
  if (pathname.startsWith('/settings/invoices')) return 'invoices';
  if (pathname.startsWith('/settings/plan')) return 'plan';
  return 'profile';
}

export default function SettingsHubContainer() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = tabFromPath(location.pathname);

  const { data } = useQuery({
    queryKey: ['clinic-settings'],
    queryFn: () =>
      callFunction<{
        clinic: { subscription_plan: string; is_solo_professional: boolean };
      }>('get-clinic-settings', {}),
    staleTime: 60_000,
  });

  const planName = planLabel(
    data?.clinic.subscription_plan ?? '',
    data?.clinic.is_solo_professional ?? false,
  );

  return (
    <div className="bg-[#F8FAF9] px-4 sm:px-6 lg:px-8">
      <PageHeader
        title={PAGE_TITLE}
        subtitle="Sua foto, dados pessoais, plano, faturas e notificações."
        tabs={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-3">
            <div className="flex min-h-0 min-w-0 flex-1 items-stretch">
              <SettingsHubTabs active={activeTab} embedded />
            </div>
            <SettingsPlanBanner
              planName={planName}
              onManage={() => navigate('/settings/plan')}
            />
          </div>
        }
      />

      <div className="mt-6 pb-6 lg:mt-8 lg:pb-8">
        <Suspense fallback={<TabPanelLoader label="Carregando seção..." className="border-0 shadow-none" />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}
