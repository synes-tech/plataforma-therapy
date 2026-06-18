import { useLocation } from 'react-router-dom';
import { PatientListTabs } from './PatientListTabs';
import { PatientActiveListView } from './PatientActiveListView';
import { PatientArchiveListView } from './PatientArchiveListView';
import type { PatientListTab } from './patient-archive.types';

export default function PatientListContainer() {
  const location = useLocation();
  const isArchive = location.pathname.startsWith('/patients/archive');
  const activeTab: PatientListTab = isArchive ? 'archive' : 'active';

  return (
    <div className="bg-[#F8FAF9] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="mb-6 md:mb-8">
        <h1 className="font-serif text-2xl font-medium tracking-tight text-charcoal md:text-3xl">
          Pacientes
        </h1>
        <p className="mt-2 text-sm text-charcoal-muted">
          {isArchive
            ? 'Histórico clínico arquivado — pacientes desvinculados da agenda ativa.'
            : 'Gerencie seus pacientes ativos e gere convites para familiares.'}
        </p>
      </header>

      <PatientListTabs active={activeTab} />

      {isArchive ? <PatientArchiveListView /> : <PatientActiveListView />}
    </div>
  );
}
