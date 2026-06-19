import { useState } from 'react';
import { useLocation } from 'react-router-dom';
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
    <div className="bg-[#F8FAF9] px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
      <header className="mb-4">
        <h1 className="font-serif text-2xl font-medium tracking-tight text-charcoal md:text-3xl">
          Pacientes
        </h1>
        <p className="mt-1 text-sm text-charcoal-muted">
          {isArchive
            ? 'Histórico clínico arquivado — pacientes desvinculados da agenda ativa.'
            : 'Gerencie seus pacientes ativos e gere convites para familiares.'}
        </p>
      </header>

      <PatientListTabs
        active={activeTab}
        action={
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
      />

      {isArchive ? (
        <PatientArchiveListView />
      ) : (
        <PatientActiveListView onOpenCreate={openCreateModal} />
      )}

      <PatientCreateModal isOpen={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
