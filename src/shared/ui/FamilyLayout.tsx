import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@shared/lib/supabase';
import { useAuth } from '@shared/hooks/useAuth';
import { UserProfile } from './UserProfile';
import { BRAND_LOGO_SRC } from '@shared/lib/brand-assets';

interface FamilyLayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Diário',
    href: '/family/diary',
    icon: (
      <svg className="h-[1.125rem] w-[1.125rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    label: 'Combinados',
    href: '/family/agreements',
    icon: (
      <svg className="h-[1.125rem] w-[1.125rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

function SidebarWarmBackground() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-brand-warm" aria-hidden />
      <div className="pointer-events-none absolute inset-0 bg-brand-warm-linen" aria-hidden />
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <svg className="absolute -left-14 -top-24 h-52 w-52 text-primary-100 opacity-30" viewBox="0 0 200 200" fill="currentColor">
          <path d="M47.5,-57.2C59.1,-46.8,64.5,-29.5,67.3,-11.7C70.1,6.2,70.2,24.5,62.1,38.2C54,51.9,37.6,61,20.3,65.8C3,70.5,-15.2,70.9,-30.8,64.7C-46.4,58.5,-59.3,45.7,-66.2,30.2C-73.1,14.7,-73.9,-3.5,-68.5,-19.3C-63,-35,-51.3,-48.3,-37.8,-58.2C-24.3,-68.1,-9,-74.7,4.9,-80.4C18.8,-86.1,35.9,-67.6,47.5,-57.2Z" transform="translate(100 100)" />
        </svg>
        <svg className="absolute -bottom-14 -right-8 h-44 w-44 text-ai-50 opacity-60" viewBox="0 0 200 200" fill="currentColor">
          <path d="M39.5,-48.6C52.9,-38.2,66.8,-27.5,71.2,-13.6C75.6,0.3,70.5,17.4,61.4,31.2C52.3,44.9,39.2,55.3,24.3,60.8C9.5,66.3,-7.1,66.9,-22.1,62C-37.1,57.1,-50.5,46.7,-58.8,33.1C-67.1,19.5,-70.3,2.8,-66.9,-12C-63.5,-26.9,-53.5,-39.9,-41.2,-50.5C-28.9,-61,-14.4,-69.1,-0.5,-68.5C13.5,-67.9,26.1,-59,39.5,-48.6Z" transform="translate(100 100)" />
        </svg>
      </div>
    </>
  );
}

function FamilySidebarNav({ isActive }: { isActive: (path: string) => boolean }) {
  return (
    <nav className="space-y-1 px-3 py-4" aria-label="Menu do portal da família">
      <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-charcoal-muted/60">
        Navegação
      </p>
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          to={item.href}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${
            isActive(item.href)
              ? 'bg-white/80 font-medium text-primary-dark shadow-sm'
              : 'text-charcoal-muted hover:bg-white/50 hover:text-charcoal'
          }`}
          aria-current={isActive(item.href) ? 'page' : undefined}
        >
          {item.icon}
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * FamilyLayout — Portal da Família.
 * Mobile: header + bottom nav (PWA). Desktop: sidebar pastel + área de conteúdo ampla.
 */
export function FamilyLayout({ children }: FamilyLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const { data: patient } = useQuery({
    queryKey: ['family-patient', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('patient_family_links')
        .select('patient_id, patients(name)')
        .eq('user_id', user!.id)
        .limit(1)
        .maybeSingle();
      return data as unknown as { patient_id: string; patients: { name: string } } | null;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  function isActive(path: string) {
    return location.pathname === path;
  }

  const patientName = patient?.patients?.name;
  const displayName = user?.email?.split('@')[0] ?? 'Família';

  return (
    <div className="flex min-h-dvh bg-[#F8FAF9]">
      {/* Desktop sidebar */}
      <aside className="relative sticky top-0 hidden h-dvh w-64 shrink-0 flex-col overflow-hidden border-r border-[#EDE4DC]/80 lg:flex">
        <SidebarWarmBackground />

        <div className="relative z-10 flex shrink-0 flex-col items-center px-6 py-5">
          <img src={BRAND_LOGO_SRC} alt="Unithery" className="h-11 w-auto object-contain" />
          <p className="mt-2 font-display text-xs font-semibold uppercase tracking-wide text-charcoal-muted/70">
            Portal da Família
          </p>
        </div>

        {patientName && (
          <div className="relative z-10 mx-4 mb-2 shrink-0 rounded-xl border border-white/60 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-charcoal-muted/60">Acompanhando</p>
            <p className="mt-0.5 truncate text-sm font-medium text-charcoal">{patientName}</p>
          </div>
        )}

        <div className="relative z-10 min-h-0 flex-1 overflow-y-auto">
          <FamilySidebarNav isActive={isActive} />
        </div>

        <div className="relative z-10 shrink-0 border-t border-charcoal/8 p-4">
          <UserProfile name={displayName} role="Família" onLogout={handleLogout} />
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/85 px-5 py-3.5 backdrop-blur-md lg:hidden">
          <div className="flex items-center gap-3">
            <img src={BRAND_LOGO_SRC} alt="Unithery" className="h-9 w-auto object-contain" />
            {patientName && (
              <div className="border-l border-slate-200 pl-3">
                <p className="text-[10px] uppercase tracking-wide text-charcoal-muted/60">Acompanhando</p>
                <p className="text-sm font-medium leading-tight text-charcoal">{patientName}</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg p-2 text-charcoal-muted/70 transition-colors hover:bg-slate-50 hover:text-charcoal"
            aria-label="Sair"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto px-5 pb-28 pt-5 lg:px-8 lg:pb-8 lg:pt-8">
          <div className="mx-auto w-full max-w-3xl">{children}</div>
        </main>

        {/* Mobile bottom nav */}
        <nav
          className="sticky bottom-0 z-20 flex shrink-0 items-stretch border-t border-slate-200/80 bg-white/90 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
          aria-label="Navegação do portal"
        >
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                  active ? 'text-primary' : 'text-charcoal-muted/70 hover:text-charcoal'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <span className={active ? 'scale-105 transition-transform' : 'transition-transform'}>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
                    {item.href.includes('diary') ? (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    )}
                  </svg>
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
