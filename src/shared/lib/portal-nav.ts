import type { PortalContext } from './portal-context';

/**
 * Navegação do Portal Unithery.
 *
 * Os destinos são os mesmos nos dois modos — o que muda é o nome. "Diário" descreve o que
 * um cuidador faz (registrar observações sobre alguém); "Meu dia" descreve o que um
 * paciente faz. Manter as rotas iguais e trocar só o rótulo evita duplicar telas por causa
 * de vocabulário, e mantém um link compartilhado válido para qualquer um dos dois.
 */

export type PortalNavIcon = 'diary' | 'calendar' | 'agreements' | 'companion' | 'help';

export interface PortalNavItem {
  label: string;
  /** Rótulo curto para a barra inferior, onde não cabe o nome completo. */
  mobileLabel?: string;
  href: string;
  icon: PortalNavIcon;
  /** Destaque central no menu mobile (Ivy). */
  featured?: boolean;
}

export const PORTAL_ROUTES = {
  diary: '/portal/diary',
  calendar: '/portal/calendar',
  agreements: '/portal/agreements',
  companion: '/portal/ivy',
  help: '/ajuda',
} as const;

const HELP_ITEM: PortalNavItem = { label: 'Ajuda', href: PORTAL_ROUTES.help, icon: 'help' };

const IVY_ITEM: PortalNavItem = {
  label: 'Ivy',
  href: PORTAL_ROUTES.companion,
  icon: 'companion',
  featured: true,
};

export function isPortalTheryPath(pathname: string): boolean {
  return (
    pathname === PORTAL_ROUTES.companion ||
    pathname === '/portal/apoio' ||
    pathname === '/portal/thery'
  );
}

export function portalNavItems(context: PortalContext | undefined): PortalNavItem[] {
  const self = context?.access.level === 'SELF';

  if (!self) {
    return [
      { label: 'Diário', href: PORTAL_ROUTES.diary, icon: 'diary' },
      { label: 'Calendário', href: PORTAL_ROUTES.calendar, icon: 'calendar' },
      {
        label: 'Relatórios e Combinados',
        mobileLabel: 'Combinados',
        href: PORTAL_ROUTES.agreements,
        icon: 'agreements',
      },
      HELP_ITEM,
    ];
  }

  return [
    { label: 'Meu dia', href: PORTAL_ROUTES.diary, icon: 'diary' },
    { label: 'Histórico', href: PORTAL_ROUTES.calendar, icon: 'calendar' },
    IVY_ITEM,
    {
      label: 'Plano de cuidados',
      mobileLabel: 'Plano',
      href: PORTAL_ROUTES.agreements,
      icon: 'agreements',
    },
    HELP_ITEM,
  ];
}

/** Rotas antigas `/family/*` continuam válidas; o destino canônico é `/portal/*`. */
export const LEGACY_PORTAL_REDIRECTS: { from: string; to: string }[] = [
  { from: '/family/diary', to: PORTAL_ROUTES.diary },
  { from: '/family/calendar', to: PORTAL_ROUTES.calendar },
  { from: '/family/agreements', to: PORTAL_ROUTES.agreements },
  { from: '/diary', to: PORTAL_ROUTES.diary },
  { from: '/portal/apoio', to: PORTAL_ROUTES.companion },
  { from: '/portal/thery', to: PORTAL_ROUTES.companion },
];
