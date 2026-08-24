import type { AuthenticatedUser } from '@shared/types';
import type { PortalContext } from '@shared/lib/portal-context';
import type {
  TheryTourAudience,
  TheryTourRuntimeContext,
  TheryTourStep,
} from './thery-tour.types';

export const TOUR_DESKTOP_MIN_WIDTH = 1024;

export function readTourViewport(width = typeof window === 'undefined' ? TOUR_DESKTOP_MIN_WIDTH : window.innerWidth): 'desktop' | 'mobile' {
  return width >= TOUR_DESKTOP_MIN_WIDTH ? 'desktop' : 'mobile';
}

export function resolveTourAudience(
  user: Pick<AuthenticatedUser, 'role'> | null,
  portal: PortalContext | undefined,
): TheryTourAudience | null {
  if (!user) return null;
  if (user.role === 'family') {
    if (!portal) return null;
    return portal.access.level === 'SELF' ? 'patient' : 'caregiver';
  }
  if (user.role === 'professional') return 'professional';
  if (user.role === 'clinic_admin' || user.role === 'master') return 'clinic_admin';
  return null;
}

export function welcomeFirstName(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return '';
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

export function resolveTourRoute(route: string, patientId: string | null): string {
  if (!route.includes(':patientId')) return route;
  return patientId ? route.replaceAll(':patientId', patientId) : route;
}

export function routeMatchesTour(pathname: string, expected: string): boolean {
  if (pathname === expected) return true;
  if (expected.endsWith('/') && pathname === expected.slice(0, -1)) return true;
  return pathname.startsWith(`${expected}/`);
}

export function selectTourSteps(steps: TheryTourStep[], ctx: TheryTourRuntimeContext): TheryTourStep[] {
  return steps.filter((step) => {
    if (step.viewport !== 'both' && step.viewport !== ctx.viewport) return false;
    if (step.requires === 'finance' && !ctx.canFinance) return false;
    if (step.requires === 'owner' && !ctx.isOwner) return false;
    if (step.requires === 'patient' && !ctx.patientId) return false;
    if (step.route.includes(':patientId') && !ctx.patientId) return false;
    return true;
  });
}

export function shouldSkipMissingTarget(step: TheryTourStep): boolean {
  if (!step.target) return false;
  return step.skipIfMissingTarget !== false;
}

export function viewportIntersectionArea(rect: DOMRectReadOnly): number {
  const left = Math.max(rect.left, 0);
  const top = Math.max(rect.top, 0);
  const right = Math.min(rect.right, window.innerWidth);
  const bottom = Math.min(rect.bottom, window.innerHeight);
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) return 0;
  return width * height;
}

export function isElementVisible(element: Element): boolean {
  if (!(element instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  return viewportIntersectionArea(rect) > 0;
}

export function findVisibleTourTarget(tourId: string): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const nodes = document.querySelectorAll(`[data-tour="${tourId}"]`);
  let best: HTMLElement | null = null;
  let bestArea = 0;
  for (const node of nodes) {
    if (!(node instanceof HTMLElement) || !isElementVisible(node)) continue;
    const area = viewportIntersectionArea(node.getBoundingClientRect());
    if (area > bestArea) {
      best = node;
      bestArea = area;
    }
  }
  return best;
}

export function spotlightRectFromElement(
  element: HTMLElement,
  pad = 6,
): { top: number; left: number; width: number; height: number } {
  const rect = element.getBoundingClientRect();
  return {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
}

export function professionalNavTourId(href: string): string | undefined {
  switch (href) {
    case '/dashboard':
      return 'nav-dashboard';
    case '/calendar':
    case '/agenda':
      return 'nav-agenda';
    case '/copilot':
      return 'nav-copilot';
    case '/session':
      return 'nav-session';
    case '/financeiro':
      return 'nav-financeiro';
    case '/patients':
      return 'nav-patients';
    case '/professionals':
      return 'nav-professionals';
    case '/settings':
      return 'nav-settings';
    case '/ajuda':
      return 'nav-ajuda';
    default:
      return undefined;
  }
}

export function portalNavTourId(href: string, featured?: boolean): string | undefined {
  if (featured || href === '/portal/ivy' || href === '/portal/thery' || href === '/portal/apoio') return 'portal-thery';
  if (href === '/portal/diary') return 'portal-diary';
  if (href === '/portal/calendar') return 'portal-calendar';
  if (href === '/portal/agreements') return 'portal-agreements';
  if (href === '/ajuda') return 'portal-ajuda';
  return undefined;
}

export function welcomeCopy(
  audience: TheryTourAudience,
  firstName: string,
): { title: string; body: string } {
  const name = firstName || 'oi';
  if (audience === 'patient') {
    return {
      title: `Oi, ${name}. Eu sou a Ivy.`,
      body:
        'Este espaço é seu, entre uma sessão e outra — sem julgamento e sem substituir o seu psicólogo. Posso te mostrar Meu dia, o histórico e onde conversar comigo.',
    };
  }
  if (audience === 'caregiver') {
    return {
      title: `Oi, ${name}. Eu sou a Ivy.`,
      body:
        'Aqui você registra o dia a dia, acompanha o calendário e vê os combinados do plano de cuidados. Posso te mostrar cada tela, ou você entra direto.',
    };
  }
  if (audience === 'clinic_admin') {
    return {
      title: `Oi, ${name}. Eu sou a Ivy.`,
      body:
        'Daqui você acompanha a clínica, a equipe e os pacientes. Posso te mostrar o caminho em uns minutos, ou você entra direto.',
    };
  }
  return {
    title: `Oi, ${name}. Eu sou a Ivy.`,
    body:
      'Daqui você cuida da agenda, do prontuário, do financeiro e conversa comigo sobre cada paciente — um de cada vez. Posso te mostrar o caminho em uns minutos, ou você entra direto.',
  };
}
