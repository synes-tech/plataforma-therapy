import { MobileNavSelect } from '@shared/ui/MobileNavSelect';
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
  /** Quando true, remove margem inferior (uso dentro do PageHeader). */
  embedded?: boolean;
}

export function PatientRecordTabs({ active, onChange, clinicalDirty, embedded }: PatientRecordTabsProps) {
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
        className={embedded ? '' : 'mb-6'}
      />

      <nav
        className={`-mx-1 hidden overflow-x-auto px-1 scrollbar-hide sm:block ${embedded ? '' : 'mb-6'}`.trim()}
        aria-label="Seções do prontuário"
      >
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

      <p className="sr-only sm:hidden">
        Seção atual: {activeLabel}
        {dirtySuffix}
      </p>
    </>
  );
}
