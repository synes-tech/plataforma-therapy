import { NavLink } from 'react-router-dom';
import type { SettingsHubTab } from './settings-hub.types';

const TABS: { id: SettingsHubTab; label: string; to: string }[] = [
  { id: 'profile', label: 'Perfil', to: '/settings' },
  { id: 'plan', label: 'Plano', to: '/settings/plan' },
  { id: 'invoices', label: 'Faturas', to: '/settings/invoices' },
];

interface SettingsHubTabsProps {
  active: SettingsHubTab;
  /** Quando true, ocupa espaço flexível ao lado do card de plano. */
  embedded?: boolean;
}

export function SettingsHubTabs({ active, embedded }: SettingsHubTabsProps) {
  return (
    <nav
      className="-mx-1 flex h-full items-stretch overflow-x-auto px-1 scrollbar-hide"
      aria-label="Controle Geral"
    >
      <div
        className={`inline-flex h-full min-w-max items-stretch gap-1 rounded-xl bg-slate-100 p-1 ${
          embedded ? 'w-full sm:min-w-0 sm:flex-1' : 'max-w-md sm:w-full'
        }`.trim()}
        role="tablist"
      >
        {TABS.map((tab) => (
          <NavLink
            key={tab.id}
            to={tab.to}
            end={tab.id === 'profile'}
            role="tab"
            aria-selected={active === tab.id}
            className={({ isActive }) =>
              `flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-all sm:flex-1 sm:px-4 sm:py-2.5 sm:text-sm ${
                isActive
                  ? 'bg-white text-charcoal shadow-sm'
                  : 'text-charcoal-muted hover:text-charcoal'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
