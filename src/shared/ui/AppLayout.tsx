import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@shared/hooks/useAuth';
import { callFunction } from '@shared/lib/api';
import { isClinicOwner } from '@shared/lib/roles';
import type { AuthenticatedUser } from '@shared/types';
import { UserProfile } from './UserProfile';

interface AppLayoutProps {
  children: React.ReactNode;
}

const roleLabels: Record<string, string> = {
  master: 'Administrador Master',
  clinic_admin: 'Admin da Clínica',
  professional: 'Profissional',
  family: 'Família',
};

interface NavItemConfig {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: string[];
  ownerOnly?: boolean;
}

/** Camadas de fundo — gradiente, textura e formas orgânicas (igual ao Login). */
function SidebarWarmBackground() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-brand-warm" aria-hidden />
      <div className="pointer-events-none absolute inset-0 bg-brand-warm-linen" aria-hidden />

      {/* Formas orgânicas decorativas — escaladas para a largura da sidebar */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <svg
          className="absolute -left-14 -top-24 h-52 w-52 text-primary-100 opacity-30"
          viewBox="0 0 200 200"
          fill="currentColor"
        >
          <path
            d="M47.5,-57.2C59.1,-46.8,64.5,-29.5,67.3,-11.7C70.1,6.2,70.2,24.5,62.1,38.2C54,51.9,37.6,61,20.3,65.8C3,70.5,-15.2,70.9,-30.8,64.7C-46.4,58.5,-59.3,45.7,-66.2,30.2C-73.1,14.7,-73.9,-3.5,-68.5,-19.3C-63,-35,-51.3,-48.3,-37.8,-58.2C-24.3,-68.1,-9,-74.7,4.9,-80.4C18.8,-86.1,35.9,-67.6,47.5,-57.2Z"
            transform="translate(100 100)"
          />
        </svg>

        <svg
          className="absolute -bottom-14 -right-8 h-44 w-44 text-ai-50 opacity-60"
          viewBox="0 0 200 200"
          fill="currentColor"
        >
          <path
            d="M39.5,-48.6C52.9,-38.2,66.8,-27.5,71.2,-13.6C75.6,0.3,70.5,17.4,61.4,31.2C52.3,44.9,39.2,55.3,24.3,60.8C9.5,66.3,-7.1,66.9,-22.1,62C-37.1,57.1,-50.5,46.7,-58.8,33.1C-67.1,19.5,-70.3,2.8,-66.9,-12C-63.5,-26.9,-53.5,-39.9,-41.2,-50.5C-28.9,-61,-14.4,-69.1,-0.5,-68.5C13.5,-67.9,26.1,-59,39.5,-48.6Z"
            transform="translate(100 100)"
          />
        </svg>

        <div className="absolute left-1/4 top-1/3 h-2.5 w-2.5 rounded-full bg-alert/20" />
        <div className="absolute bottom-1/3 right-1/4 h-2 w-2 rounded-full bg-primary-200/40" />
      </div>
    </>
  );
}

const NAV_ITEMS: NavItemConfig[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    roles: ['master', 'clinic_admin', 'professional', 'family'],
    icon: (
      <svg className="h-[1.125rem] w-[1.125rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    label: 'Agenda',
    href: '/calendar',
    roles: ['professional'],
    icon: (
      <svg className="h-[1.125rem] w-[1.125rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    label: 'Terapeutas',
    href: '/professionals',
    roles: ['master', 'clinic_admin'],
    icon: (
      <svg className="h-[1.125rem] w-[1.125rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: 'Pacientes',
    href: '/patients',
    roles: ['professional', 'clinic_admin', 'master'],
    icon: (
      <svg className="h-[1.125rem] w-[1.125rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    label: 'Relatórios',
    href: '/reports',
    roles: ['professional'],
    icon: (
      <svg className="h-[1.125rem] w-[1.125rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    label: 'Copiloto IA',
    href: '/copilot',
    roles: ['professional'],
    icon: (
      <svg className="h-[1.125rem] w-[1.125rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
      </svg>
    ),
  },
  {
    label: 'Diário',
    href: '/diary',
    roles: ['family'],
    icon: (
      <svg className="h-[1.125rem] w-[1.125rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    label: 'Faturas',
    href: '/billing',
    roles: ['master', 'clinic_admin', 'professional'],
    ownerOnly: true,
    icon: (
      <svg className="h-[1.125rem] w-[1.125rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
      </svg>
    ),
  },
  {
    label: 'Configurações',
    href: '/settings',
    roles: ['master', 'clinic_admin', 'professional'],
    ownerOnly: true,
    icon: (
      <svg className="h-[1.125rem] w-[1.125rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

function SidebarNav({
  user,
  isActive,
  onNavigate,
}: {
  user: AuthenticatedUser | null;
  isActive: (path: string) => boolean;
  onNavigate?: () => void;
}) {
  const owner = isClinicOwner(user);
  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!user || !item.roles.includes(user.role)) return false;
    if (item.ownerOnly && !owner) return false;
    return true;
  });

  return (
    <nav className="space-y-1 px-3 py-4" aria-label="Menu principal">
      <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-charcoal-muted/60">
        Navegação
      </p>
      {visibleItems.map((item) => (
        <Link
          key={item.href}
          to={item.href}
          onClick={onNavigate}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${
            isActive(item.href)
              ? 'bg-white/80 font-medium text-primary-dark shadow-sm'
              : 'text-charcoal-muted hover:bg-white/50 hover:text-charcoal'
          }`}
        >
          {item.icon}
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: dashboardData } = useQuery({
    queryKey: ['clinic-dashboard'],
    queryFn: () => callFunction<{ admin_name: string }>('get-clinic-dashboard', {}),
    enabled: user?.role === 'clinic_admin',
    staleTime: 60_000,
  });

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  function isActive(path: string) {
    return location.pathname === path;
  }

  const displayName =
    dashboardData?.admin_name ??
    user?.email?.split('@')[0] ??
    'Usuário';

  const displayRole = user ? roleLabels[user.role] ?? user.role : '';

  return (
    <div className="flex min-h-dvh bg-[#F8FAF9]">
      {/* Desktop Sidebar — altura fixa; fundo pastel do Login; só a navegação rola */}
      <aside className="relative sticky top-0 hidden h-dvh w-64 shrink-0 flex-col overflow-hidden border-r border-[#EDE4DC]/80 lg:flex">
        <SidebarWarmBackground />

        <div className="relative z-10 flex shrink-0 items-center justify-center px-6 py-5">
          <img
            src="/src/assets/logotherapy.png"
            alt="Therapy.AI"
            className="h-12 w-auto object-contain"
          />
        </div>

        <div className="relative z-10 min-h-0 flex-1 overflow-y-auto">
          <SidebarNav user={user} isActive={isActive} />
        </div>

        <div className="relative z-10 shrink-0 border-t border-charcoal/8 p-4">
          <UserProfile
            name={displayName}
            role={displayRole}
            onLogout={handleLogout}
          />
        </div>
      </aside>

      {/* Mobile drawer overlay */}
      {mobileMenuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-charcoal/30 lg:hidden"
          aria-label="Fechar menu"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile drawer — mesma estrutura e fundo pastel do Login */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-72 flex-col overflow-hidden border-r border-[#EDE4DC]/80 transition-transform duration-200 lg:hidden ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarWarmBackground />

        <div className="relative z-10 flex shrink-0 items-center justify-center px-5 py-4">
          <img src="/src/assets/logotherapy.png" alt="Therapy.AI" className="h-12 w-auto object-contain" />
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="absolute right-5 rounded-lg p-2 text-charcoal-muted hover:bg-white/50"
            aria-label="Fechar menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="relative z-10 min-h-0 flex-1 overflow-y-auto">
          <SidebarNav
            user={user}
            isActive={isActive}
            onNavigate={() => setMobileMenuOpen(false)}
          />
        </div>

        <div className="relative z-10 shrink-0 border-t border-charcoal/8 p-4">
          <UserProfile name={displayName} role={displayRole} onLogout={handleLogout} />
        </div>
      </aside>

      {/* Main */}
      <main className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="rounded-lg p-2 text-charcoal-muted hover:bg-slate-50"
            aria-label="Abrir menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <img src="/src/assets/logotherapy.png" alt="Therapy.AI" className="h-[2.625rem] w-auto object-contain" />
          <UserProfile
            name={displayName}
            role={displayRole}
            onLogout={handleLogout}
            compact
          />
        </div>

        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
