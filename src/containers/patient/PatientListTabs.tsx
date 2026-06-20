import { NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { MobileNavSelect } from '@shared/ui/MobileNavSelect';
import type { PatientListTab } from './patient-archive.types';

const TABS: { id: PatientListTab; label: string; to: string }[] = [
  { id: 'active', label: 'Ativos', to: '/patients' },
  { id: 'archive', label: 'Arquivo Clínico', to: '/patients/archive' },
];

interface PatientListTabsProps {
  active: PatientListTab;
  action?: ReactNode;
}

export function PatientListTabs({ active, action }: PatientListTabsProps) {
  const navigate = useNavigate();

  return (
    <div className={action ? 'mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between' : ''}>
      <MobileNavSelect
        value={active}
        options={TABS.map((tab) => ({ value: tab.id, label: tab.label }))}
        onChange={(id) => {
          const tab = TABS.find((t) => t.id === id);
          if (tab) navigate(tab.to);
        }}
        ariaLabel="Pacientes"
      />

      <nav className="-mx-1 hidden overflow-x-auto px-1 scrollbar-hide sm:block" aria-label="Pacientes">
        <div
          className="inline-flex min-w-max gap-1 rounded-xl bg-slate-100 p-1 sm:min-w-0 sm:w-full sm:max-w-md"
          role="tablist"
        >
          {TABS.map((tab) => {
            const isActive = active === tab.id;
            return (
              <NavLink
                key={tab.id}
                to={tab.to}
                end={tab.id === 'active'}
                role="tab"
                aria-selected={isActive}
                className={({ isActive: linkActive }) =>
                  `flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition-all sm:flex-1 ${
                    linkActive || isActive
                      ? 'bg-white text-charcoal shadow-sm'
                      : 'text-charcoal-muted hover:text-charcoal'
                  }`
                }
              >
                {tab.label}
              </NavLink>
            );
          })}
        </div>
      </nav>

      {action ? <div className="shrink-0 sm:ml-4">{action}</div> : null}
    </div>
  );
}
