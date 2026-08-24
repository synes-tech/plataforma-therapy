import { Link } from 'react-router-dom';
import { professionalNavTourId } from '@containers/onboarding-thery/thery-tour.utils';
import { THERY_AVATAR_SRC } from '@shared/lib/thery-assets';
import {
  PROFESSIONAL_MOBILE_TABS,
  isProfessionalMobileTabActive,
  type ProfessionalMobileTab,
} from './professional-mobile-tabs';

function TabIcon({ id, className }: { id: ProfessionalMobileTab['id']; className?: string }) {
  const cls = className ?? 'h-5 w-5';
  if (id === 'dashboard') {
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    );
  }
  if (id === 'agenda') {
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }
  if (id === 'patients') {
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    );
  }
  if (id === 'financeiro') {
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    );
  }
  return null;
}

interface ProfessionalMobileTabBarProps {
  pathname: string;
}

export function ProfessionalMobileTabBar({ pathname }: ProfessionalMobileTabBarProps) {
  return (
    <nav
      className="relative z-40 flex shrink-0 items-end overflow-visible border-t border-slate-200/80 bg-white/95 px-1 pt-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      aria-label="Navegação principal"
    >
      {PROFESSIONAL_MOBILE_TABS.map((tab) => {
        const active = isProfessionalMobileTabActive(pathname, tab.href);

        if (tab.featured) {
          return (
            <Link
              key={tab.id}
              to={tab.href}
              aria-label="IVY - Assistente Virtual"
              aria-current={active ? 'page' : undefined}
              className="relative flex flex-1 flex-col items-center justify-end pb-1.5 pt-1"
            >
              <span
                data-tour={professionalNavTourId(tab.href)}
                className={`-mt-4 mb-1 flex h-[3.25rem] w-[3.25rem] items-center justify-center overflow-hidden rounded-full bg-white shadow-lg shadow-primary/25 ring-4 transition-transform ${
                  active ? 'scale-105 ring-primary/40' : 'ring-[#F8FAF9] hover:scale-105'
                }`}
              >
                <img
                  src={THERY_AVATAR_SRC}
                  alt=""
                  className="h-full w-full object-cover object-[center_12%]"
                  draggable={false}
                />
              </span>
              <span className={`text-[10px] font-semibold ${active ? 'text-primary' : 'text-charcoal-muted'}`}>
                {tab.label}
              </span>
            </Link>
          );
        }

        return (
          <Link
            key={tab.id}
            to={tab.href}
            data-tour={professionalNavTourId(tab.href)}
            aria-label={tab.label}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
              active ? 'text-primary' : 'text-charcoal-muted/70'
            }`}
          >
            <TabIcon id={tab.id} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
