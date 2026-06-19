import type { PatientRecordTab } from './patient-record.types';

const TABS: { id: PatientRecordTab; label: string }[] = [
  { id: 'copilot', label: 'Copiloto de IA' },
  { id: 'overview', label: 'Histórico de Sessões' },
  { id: 'checkins', label: 'Check-ins' },
  { id: 'clinical', label: 'Ficha Clínica' },
  { id: 'documents', label: 'Documentos Salvos' },
];

interface PatientRecordTabsProps {
  active: PatientRecordTab;
  onChange: (tab: PatientRecordTab) => void;
  clinicalDirty?: boolean;
}

export function PatientRecordTabs({ active, onChange, clinicalDirty }: PatientRecordTabsProps) {
  return (
    <nav className="mb-6 -mx-1 overflow-x-auto px-1 scrollbar-hide" aria-label="Seções do prontuário">
      <div
        className="inline-flex min-w-max gap-1 rounded-xl bg-slate-100 p-1 sm:min-w-0 sm:w-full"
        role="tablist"
      >
        {TABS.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={`relative flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition-all sm:flex-1 ${
                isActive
                  ? 'bg-white text-charcoal shadow-sm'
                  : 'text-charcoal-muted hover:text-charcoal'
              }`}
            >
              {tab.label}
              {tab.id === 'clinical' && clinicalDirty && (
                <span
                  className="h-2 w-2 shrink-0 rounded-full bg-amber-500"
                  title="Alterações não salvas"
                  aria-label="Alterações não salvas"
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
