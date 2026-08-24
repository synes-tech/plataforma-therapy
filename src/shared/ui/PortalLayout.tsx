import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@shared/hooks/useAuth';
import { useSidebarCollapsed } from '@shared/hooks/useSidebarCollapsed';
import { UserProfile } from './UserProfile';
import { BRAND_ICON_SRC, BRAND_LOGO_SRC } from '@shared/lib/brand-assets';
import { portalTitle, usePortalContext } from '@shared/lib/portal-context';
import { isPortalTheryPath, portalNavItems, type PortalNavIcon, type PortalNavItem } from '@shared/lib/portal-nav';
import { TheryTourProvider } from '@containers/onboarding-thery/TheryTourProvider';
import { portalNavTourId } from '@containers/onboarding-thery/thery-tour.utils';

interface PortalLayoutProps {
  children: React.ReactNode;
}

const ICON_PATHS: Record<PortalNavIcon, string> = {
  diary: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  agreements: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  companion: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 21l1.4-3.5A7.6 7.6 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  help: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
};

function NavIcon({ icon, className }: { icon: PortalNavIcon; className: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d={ICON_PATHS[icon]} />
    </svg>
  );
}

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

function PortalSidebarNav({
  items,
  isActive,
  collapsed = false,
}: {
  items: PortalNavItem[];
  isActive: (path: string) => boolean;
  collapsed?: boolean;
}) {
  return (
    <nav className={`space-y-1 py-4 ${collapsed ? 'px-2' : 'px-3'}`} aria-label="Menu do portal">
      {collapsed ? null : (
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-charcoal-muted/60">
          Navegação
        </p>
      )}
      {items.map((item) => (
        <Link
          key={item.href}
          to={item.href}
          data-tour={portalNavTourId(item.href, item.featured)}
          title={collapsed ? item.label : undefined}
          aria-label={item.label}
          className={`flex items-center rounded-xl text-sm transition-all ${
            collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
          } ${
            isActive(item.href)
              ? 'bg-white/80 font-medium text-primary-dark shadow-sm'
              : item.featured
                ? 'font-medium text-charcoal hover:bg-white/60'
                : 'text-charcoal-muted hover:bg-white/50 hover:text-charcoal'
          }`}
          aria-current={isActive(item.href) ? 'page' : undefined}
        >
          <NavIcon icon={item.icon} className="h-[1.125rem] w-[1.125rem]" />
          {collapsed ? <span className="sr-only">{item.label}</span> : item.label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * PortalLayout — Portal Unithery, nos dois modos.
 *
 * A navegação, o título e a forma de se referir ao paciente vêm do contexto: um cuidador vê
 * "Acompanhando Lucas"; o próprio paciente vê o seu espaço, sem ler o próprio nome em
 * terceira pessoa.
 */
function PortalLayoutChrome({ children }: PortalLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { collapsed, toggle } = useSidebarCollapsed();
  const { data: portal } = usePortalContext();

  const navItems = portalNavItems(portal);
  const selfMode = portal?.access.level === 'SELF';
  const hasFeaturedNav = navItems.some((item) => item.featured);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  function isActive(path: string) {
    return location.pathname === path;
  }

  const patientName = portal?.patient.name;
  const displayName = user?.email?.split('@')[0] ?? 'Portal';
  const isTheryChat = isPortalTheryPath(location.pathname);

  return (
    <div className="flex min-h-dvh bg-[#F8FAF9]" data-sidebar={collapsed ? 'collapsed' : 'expanded'}>
      {/* Desktop sidebar */}
      <aside
        className={`relative sticky top-0 hidden h-dvh shrink-0 flex-col overflow-hidden border-r border-[#EDE4DC]/80 transition-[width] duration-200 lg:flex ${
          collapsed ? 'w-[4.5rem]' : 'w-64'
        }`}
      >
        <SidebarWarmBackground />

        <div className={`relative z-10 flex shrink-0 flex-col items-center py-5 ${collapsed ? 'px-2' : 'px-6'}`}>
          <img
            src={collapsed ? BRAND_ICON_SRC : BRAND_LOGO_SRC}
            alt="Unithery"
            className={`object-contain ${collapsed ? 'h-10 w-10 rounded-xl' : 'h-11 w-auto'}`}
          />
          {collapsed ? null : (
            <p className="mt-2 font-display text-xs font-semibold uppercase tracking-wide text-charcoal-muted/70">
              {portalTitle(portal)}
            </p>
          )}
        </div>

        {patientName && !collapsed && !selfMode ? (
          <div className="relative z-10 mx-4 mb-2 shrink-0 rounded-xl border border-white/60 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-charcoal-muted/60">Acompanhando</p>
            <p className="mt-0.5 truncate text-sm font-medium text-charcoal">{patientName}</p>
          </div>
        ) : null}

        <div className="relative z-10 min-h-0 flex-1 overflow-y-auto">
          <PortalSidebarNav items={navItems} isActive={isActive} collapsed={collapsed} />
        </div>

        <div className={`relative z-10 shrink-0 ${collapsed ? 'px-2 pb-1' : 'px-3 pb-1'}`}>
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            title={collapsed ? 'Expandir' : 'Recolher'}
            className={`flex w-full items-center rounded-xl text-sm text-charcoal-muted transition-all hover:bg-white/50 hover:text-charcoal ${
              collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
            }`}
          >
            <svg
              className={`h-[1.125rem] w-[1.125rem] transition-transform ${collapsed ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {collapsed ? <span className="sr-only">Expandir</span> : 'Recolher'}
          </button>
        </div>

        <div className={`relative z-10 shrink-0 border-t border-charcoal/8 ${collapsed ? 'p-2' : 'p-4'}`}>
          <UserProfile
            name={displayName}
            role={selfMode ? 'Meu acompanhamento' : 'Família'}
            onLogout={handleLogout}
            compact={collapsed}
          />
        </div>
      </aside>

      {/* Main */}
      <div className={`flex min-h-0 min-w-0 flex-1 flex-col ${isTheryChat ? 'h-dvh overflow-hidden' : ''}`}>
        {/* Mobile header — a tela da Ivy tem o próprio chrome */}
        <header className={`sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/85 px-5 py-3.5 backdrop-blur-md lg:hidden ${isTheryChat ? 'hidden' : ''}`}>
          <div className="flex items-center gap-3">
            <img src={BRAND_LOGO_SRC} alt="Unithery" className="h-9 w-auto object-contain" />
            {patientName && !selfMode && (
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

        <main
          className={
            isTheryChat
              ? 'flex min-h-0 flex-1 flex-col overflow-hidden p-0'
              : 'flex-1 overflow-y-auto px-5 pb-28 pt-5 lg:px-8 lg:pb-8 lg:pt-8'
          }
        >
          <div
            className={
              isTheryChat
                ? 'flex min-h-0 w-full min-w-0 flex-1 flex-col'
                : 'w-full min-w-0'
            }
          >
            {children}
          </div>
        </main>

        {/* Mobile bottom nav */}
        <nav
          className={`sticky bottom-0 z-20 flex shrink-0 items-end border-t border-slate-200/80 bg-white/90 px-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden ${
            hasFeaturedNav ? 'pt-6' : 'pt-1.5'
          }`}
          aria-label="Navegação do portal"
        >
          {navItems.map((item) => {
            const active = isActive(item.href);
            if (item.featured) {
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className="relative flex flex-1 flex-col items-center justify-end"
                  aria-current={active ? 'page' : undefined}
                  aria-label={item.label}
                >
                  <span
                    data-tour={portalNavTourId(item.href, item.featured)}
                    className={`-mt-10 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_8px_20px_rgba(26,134,226,0.35)] ring-4 ring-white transition-transform ${
                      active ? 'bg-primary scale-105' : 'bg-charcoal hover:bg-charcoal/90'
                    }`}
                  >
                    <NavIcon icon={item.icon} className="h-6 w-6" />
                  </span>
                  <span
                    className={`mt-1 text-[11px] font-semibold ${
                      active ? 'text-primary' : 'text-charcoal-muted'
                    }`}
                  >
                    {item.mobileLabel ?? item.label}
                  </span>
                </Link>
              );
            }
            return (
              <Link
                key={item.href}
                to={item.href}
                data-tour={portalNavTourId(item.href, item.featured)}
                className={`flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors ${
                  active ? 'text-primary' : 'text-charcoal-muted/70 hover:text-charcoal'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <span className={active ? 'scale-105 transition-transform' : 'transition-transform'}>
                  <NavIcon icon={item.icon} className="h-5 w-5" />
                </span>
                {item.mobileLabel ?? item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export function PortalLayout({ children }: PortalLayoutProps) {
  return (
    <TheryTourProvider>
      <PortalLayoutChrome>{children}</PortalLayoutChrome>
    </TheryTourProvider>
  );
}
