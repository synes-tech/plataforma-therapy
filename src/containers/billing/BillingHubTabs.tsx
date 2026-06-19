import { NavLink } from 'react-router-dom';
import type { BillingHubTab } from './billing-hub.types';

const TABS: { id: BillingHubTab; label: string; to: string }[] = [
  { id: 'plan', label: 'Controle de Plano', to: '/billing' },
  { id: 'invoices', label: 'Faturas', to: '/billing/invoices' },
];

interface BillingHubTabsProps {
  active: BillingHubTab;
}

export function BillingHubTabs({ active }: BillingHubTabsProps) {
  return (
    <nav className="-mx-1 overflow-x-auto px-1 scrollbar-hide" aria-label="Plano e faturas">
      <div
        className="inline-flex min-w-max max-w-md gap-1 rounded-xl bg-slate-100 p-1 sm:min-w-0 sm:w-full"
        role="tablist"
      >
        {TABS.map((tab) => (
          <NavLink
            key={tab.id}
            to={tab.to}
            end={tab.id === 'plan'}
            role="tab"
            aria-selected={active === tab.id}
            className={({ isActive }) =>
              `flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition-all sm:flex-1 ${
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
