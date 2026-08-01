import { Suspense } from 'react';
import { PageHeader } from '@containers/layout';
import { TabPanelLoader } from '@containers/loading';
import SettingsPlanTab from './SettingsPlanTab';

export default function AssinaturaContainer() {
  return (
    <div className="bg-[#F8FAF9] px-4 sm:px-6 lg:px-8">
      <PageHeader
        title="Gestão da Assinatura"
        subtitle="Plano, cotas, upgrades e cobrança da Unithery."
      />

      <div className="mt-6 pb-6 lg:mt-8 lg:pb-8">
        <Suspense fallback={<TabPanelLoader label="Carregando assinatura..." className="border-0 shadow-none" />}>
          <SettingsPlanTab />
        </Suspense>
      </div>
    </div>
  );
}
