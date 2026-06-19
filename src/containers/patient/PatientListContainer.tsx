import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PageHeader } from '@containers/layout';
import { usePaywall } from '@containers/paywall';
import { PatientListTabs } from './PatientListTabs';
import { PatientActiveListView } from './PatientActiveListView';
import { PatientArchiveListView } from './PatientArchiveListView';
import { PatientCreateModal } from './PatientCreateModal';
import type { PatientListTab } from './patient-archive.types';

export default function PatientListContainer() {
  const location = useLocation();
  const { interceptNewPatient } = usePaywall();
  const [showCreate, setShowCreate] = useState(false);

  const isArchive = location.pathname.startsWith('/patients/archive');
  const activeTab: PatientListTab = isArchive ? 'archive' : 'active';

  function openCreateModal() {
    interceptNewPatient(() => setShowCreate(true));
  }

  return (
    <div className="bg-[#F8FAF9] px-4 sm:px-6 lg:px-8">
      <PageHeader
        title="Pacientes"
        subtitle={
          isArchive
            ? 'Histórico clínico arquivado — pacientes desvinculados da agenda ativa.'
            : 'Gerencie seus pacientes ativos e gere convites para familiares.'
        }
        actions={
          !isArchive ? (
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-dark active:scale-[0.98] sm:w-auto"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Novo Paciente
            </button>
          ) : undefined
        }
        tabs={<PatientListTabs active={activeTab} />}
      />

      <div className="mt-6 pb-6 lg:mt-8 lg:pb-8">
        {isArchive ? (
          <PatientArchiveListView />
        ) : (
          <PatientActiveListView onOpenCreate={openCreateModal} />
        )}
      </div>

      <PatientCreateModal isOpen={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
