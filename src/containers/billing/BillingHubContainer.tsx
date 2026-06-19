import { Suspense } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { TabPanelLoader } from '@containers/loading';

const TABS = [
  { id: 'plan', label: 'Controle de Plano', to: '/billing' },
  { id: 'invoices', label: 'Faturas', to: '/billing/invoices' },
] as const;

export default function BillingHubContainer() {
  const location = useLocation();
  const activeTab = location.pathname.startsWith('/billing/invoices') ? 'invoices' : 'plan';

  return (
    <div className="bg-[#F8FAF9] px-5 py-6 lg:px-8 lg:py-8">
      <header className="mb-6 md:mb-8">
        <h1 className="font-serif text-2xl font-medium tracking-tight text-charcoal md:text-3xl">
          Plano e Faturas
        </h1>
        <p className="mt-1 text-sm text-charcoal-muted">
          Gerencie seu plano, extensões de backup e histórico de cobranças.
        </p>
      </header>

      <nav className="mb-6 -mx-1 overflow-x-auto px-1 scrollbar-hide" aria-label="Plano e faturas">
        <div
          className="inline-flex min-w-max gap-1 rounded-xl bg-slate-100 p-1 sm:min-w-0 sm:w-full max-w-md"
          role="tablist"
        >
          {TABS.map((tab) => (
            <NavLink
              key={tab.id}
              to={tab.to}
              end={tab.id === 'plan'}
              role="tab"
              aria-selected={activeTab === tab.id}
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

      <Suspense fallback={<TabPanelLoader label="Carregando seção..." className="border-0 shadow-none" />}>
        <Outlet />
      </Suspense>
    </div>
  );
}
