import { NavLink, useNavigate } from 'react-router-dom';
import { MobileNavSelect } from '@shared/ui/MobileNavSelect';
import type { BillingHubTab } from './billing-hub.types';

const TABS: { id: BillingHubTab; label: string; to: string }[] = [
  { id: 'plan', label: 'Controle de Plano', to: '/billing' },
  { id: 'invoices', label: 'Faturas', to: '/billing/invoices' },
];

interface BillingHubTabsProps {
  active: BillingHubTab;
}

export function BillingHubTabs({ active }: BillingHubTabsProps) {
  const navigate = useNavigate();

  return (
    <>
      <MobileNavSelect
        value={active}
        options={TABS.map((tab) => ({ value: tab.id, label: tab.label }))}
        onChange={(id) => {
          const tab = TABS.find((t) => t.id === id);
          if (tab) navigate(tab.to);
        }}
        ariaLabel="Plano e faturas"
        className="w-full"
      />

      <nav className="-mx-1 hidden overflow-x-auto px-1 scrollbar-hide sm:block" aria-label="Plano e faturas">
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
    </>
  );
}
