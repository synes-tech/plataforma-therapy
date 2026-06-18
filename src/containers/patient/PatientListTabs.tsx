import { NavLink } from 'react-router-dom';
import type { PatientListTab } from './patient-archive.types';

const TABS: { id: PatientListTab; label: string; to: string }[] = [
  { id: 'active', label: 'Ativos', to: '/patients' },
  { id: 'archive', label: 'Arquivo Clínico', to: '/patients/archive' },
];

interface PatientListTabsProps {
  active: PatientListTab;
}

export function PatientListTabs({ active }: PatientListTabsProps) {
  return (
    <nav className="mb-6 -mx-1 overflow-x-auto px-1 scrollbar-hide" aria-label="Pacientes">
      <div
        className="inline-flex min-w-max gap-1 rounded-xl bg-slate-100 p-1 sm:min-w-0 sm:w-full max-w-md"
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
  );
}
