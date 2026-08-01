import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { PageHeader } from '@containers/layout';
import { TabPanelLoader } from '@containers/loading';

export default function SettingsHubContainer() {
  return (
    <div className="bg-[#F8FAF9] px-4 sm:px-6 lg:px-8">
      <PageHeader
        title="Perfil/Configurações"
        subtitle="Sua foto, dados pessoais e preferências da conta."
      />

      <div className="mt-6 pb-6 lg:mt-8 lg:pb-8">
        <Suspense fallback={<TabPanelLoader label="Carregando seção..." className="border-0 shadow-none" />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}
