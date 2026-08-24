import { MobileNavSelect } from '@shared/ui/MobileNavSelect';
import { FAMILY_REPORTS_TABS, type FamilyReportsTab } from './family-reports.types';

interface FamilyReportsTabsProps {
  active: FamilyReportsTab;
  onChange: (tab: FamilyReportsTab) => void;
}

export function FamilyReportsTabs({ active, onChange }: FamilyReportsTabsProps) {
  const activeLabel = FAMILY_REPORTS_TABS.find((t) => t.id === active)?.label ?? 'Seção';

  return (
    <>
      <MobileNavSelect
        value={active}
        options={FAMILY_REPORTS_TABS.map((tab) => ({ value: tab.id, label: tab.label }))}
        onChange={onChange}
        ariaLabel="Seções de relatórios e combinados"
        className="mb-6"
      />

      <nav
        className="-mx-1 mb-6 hidden overflow-x-auto px-1 scrollbar-hide sm:block"
        aria-label="Seções de relatórios e combinados"
      >
        <div className="inline-flex min-w-max gap-1 rounded-xl bg-slate-100 p-1 sm:min-w-0 sm:w-full" role="tablist">
          {FAMILY_REPORTS_TABS.map((tab) => {
            const isActive = active === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onChange(tab.id)}
                className={`relative flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition-all sm:flex-1 ${
                  isActive ? 'bg-white text-charcoal shadow-sm' : 'text-charcoal-muted hover:text-charcoal'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      <p className="sr-only sm:hidden">Seção atual: {activeLabel}</p>
    </>
  );
}
