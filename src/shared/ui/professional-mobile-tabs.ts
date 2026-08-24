export interface ProfessionalMobileTab {
  id: 'dashboard' | 'agenda' | 'copilot' | 'patients' | 'financeiro';
  label: string;
  href: string;
  featured?: boolean;
}

export const PROFESSIONAL_MOBILE_TABS: ProfessionalMobileTab[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard' },
  { id: 'agenda', label: 'Agenda', href: '/calendar' },
  { id: 'copilot', label: 'IVY', href: '/copilot', featured: true },
  { id: 'financeiro', label: 'Financeiro', href: '/financeiro' },
  { id: 'patients', label: 'Pacientes', href: '/patients' },
];

export function isProfessionalMobileTabActive(pathname: string, href: string): boolean {
  if (href === '/calendar') {
    return (
      pathname === '/calendar' ||
      pathname.startsWith('/calendar/') ||
      pathname === '/agenda' ||
      pathname.startsWith('/agenda/')
    );
  }

  if (href === '/patients') {
    return pathname === '/patients' || pathname.startsWith('/patients/');
  }

  if (href === '/copilot') {
    return pathname === '/copilot' || pathname.startsWith('/copilot/');
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function shouldShowProfessionalMobileTabs(role: string | undefined): boolean {
  return role === 'professional';
}
