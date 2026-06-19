import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { PageHeader } from '@containers/layout';
import { TabPanelLoader } from '@containers/loading';
import { BillingHubTabs } from './BillingHubTabs';
import type { BillingHubTab } from './billing-hub.types';

export default function BillingHubContainer() {
  const location = useLocation();
  const activeTab: BillingHubTab = location.pathname.startsWith('/billing/invoices')
    ? 'invoices'
    : 'plan';

  return (
    <div className="bg-[#F8FAF9] px-4 sm:px-6 lg:px-8">
      <PageHeader
        title="Plano e Faturas"
        subtitle="Gerencie seu plano, extensões de backup e histórico de cobranças."
        tabs={<BillingHubTabs active={activeTab} />}
      />

      <div className="mt-6 lg:mt-8">
        <Suspense fallback={<TabPanelLoader label="Carregando seção..." className="border-0 shadow-none" />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}
