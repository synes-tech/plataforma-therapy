import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ListPageSkeleton } from '@containers/loading';
import { callFunction } from '@shared/lib/api';
import { FamilyReportsTabs } from './reports/FamilyReportsTabs';
import { FamilyReportsOverviewTab, type LatestAgreementsData } from './reports/FamilyReportsOverviewTab';
import { FamilySessionHistoryTab } from './reports/FamilySessionHistoryTab';
import { FamilySharedDocumentsTab } from './reports/FamilySharedDocumentsTab';
import { FamilyClinicalRecordTab } from './reports/FamilyClinicalRecordTab';
import type { FamilyReportsTab } from './reports/family-reports.types';

export default function Agreements() {
  const [activeTab, setActiveTab] = useState<FamilyReportsTab>('overview');

  const { data, isLoading, error } = useQuery({
    queryKey: ['latest-agreements'],
    queryFn: () => callFunction<LatestAgreementsData>('get-latest-agreements', {}),
    staleTime: 2 * 60_000,
  });

  return (
    <div className="animate-fade-in w-full">
      <header className="mb-6 lg:mb-8">
        <h1 className="font-serif text-2xl tracking-tight text-charcoal lg:text-3xl">Relatórios e Combinados</h1>
        <p className="mt-1 text-sm text-charcoal-muted lg:text-base">
          Orientações do terapeuta, histórico de sessões e documentos compartilhados com{' '}
          {data?.patient_name?.split(' ')[0] ?? 'seu filho(a)'}.
        </p>
      </header>

      <FamilyReportsTabs active={activeTab} onChange={setActiveTab} />

      {isLoading && activeTab === 'overview' && (
        <ListPageSkeleton rows={2} rowClassName="h-32 rounded-2xl" className="space-y-4" />
      )}

      {error && activeTab === 'overview' && (
        <div role="alert" className="rounded-xl border border-error/15 bg-error-light/40 px-4 py-3 text-sm text-error">
          {error instanceof Error ? error.message : 'Erro ao carregar combinados'}
        </div>
      )}

      {activeTab === 'overview' && data && !isLoading && <FamilyReportsOverviewTab data={data} />}

      {activeTab === 'sessions' && <FamilySessionHistoryTab />}

      {activeTab === 'documents' && <FamilySharedDocumentsTab />}

      {activeTab === 'clinical' && <FamilyClinicalRecordTab />}
    </div>
  );
}
