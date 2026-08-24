import { MobileNavSelect } from '@shared/ui/MobileNavSelect';
import type { PatientRecordTab } from './patient-record.types';

const TABS: { id: PatientRecordTab; label: string }[] = [
  { id: 'copilot', label: 'Copiloto de IA' },
  { id: 'overview', label: 'Histórico de Sessões' },
  { id: 'checkins', label: 'Check-ins' },
  { id: 'clinical', label: 'Ficha Clínica' },
  { id: 'financeiro', label: 'Financeiro' },
  { id: 'documents', label: 'Documentos Salvos' },
];

interface PatientRecordTabsProps {
  active: PatientRecordTab;
  onChange: (tab: PatientRecordTab) => void;
  clinicalDirty?: boolean;
}

export function PatientRecordTabs({ active, onChange, clinicalDirty }: PatientRecordTabsProps) {
  const activeLabel = TABS.find((t) => t.id === active)?.label ?? 'Seção';
  const dirtySuffix = clinicalDirty && active === 'clinical' ? ' • não salvo' : '';

  return (
    <>
      <MobileNavSelect
        value={active}
        options={TABS.map((tab) => ({
          value: tab.id,
          label: tab.id === 'clinical' && clinicalDirty ? `${tab.label} • não salvo` : tab.label,
        }))}
        onChange={onChange}
        ariaLabel="Seções do prontuário"
        className="w-full"
        dataTour="patient-tabs"
      />

      <nav className="hidden w-full sm:block" aria-label="Seções do prontuário">
        <div
          className="flex w-full items-stretch gap-1 rounded-xl border border-[#E4D5C8] bg-[#F0E6DC] p-1"
          role="tablist"
          data-tour="patient-tabs"
        >
          {TABS.map((tab) => {
            const isActive = active === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                data-tour={`patient-tab-${tab.id}`}
                aria-selected={isActive}
                onClick={() => onChange(tab.id)}
                className={`relative flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-2.5 text-center text-sm font-medium transition-colors ${
                  isActive ? 'bg-white text-primary shadow-sm' : 'text-charcoal-muted hover:text-charcoal'
                }`}
              >
                <span className="truncate">{tab.label}</span>
                {tab.id === 'clinical' && clinicalDirty ? (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full bg-amber-500"
                    title="Alterações não salvas"
                    aria-label="Alterações não salvas"
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>

      <p className="sr-only sm:hidden">
        Seção atual: {activeLabel}
        {dirtySuffix}
      </p>
    </>
  );
}
