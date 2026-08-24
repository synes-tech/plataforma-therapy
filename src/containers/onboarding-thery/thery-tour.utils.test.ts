/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import type { AuthenticatedUser } from '@shared/types';
import type { PortalContext } from '@shared/lib/portal-context';
import type { TheryTourRuntimeContext, TheryTourStep } from './thery-tour.types';
import {
  findVisibleTourTarget,
  portalNavTourId,
  professionalNavTourId,
  readTourViewport,
  resolveTourAudience,
  resolveTourRoute,
  routeMatchesTour,
  selectTourSteps,
  shouldSkipMissingTarget,
  spotlightRectFromElement,
  welcomeCopy,
  welcomeFirstName,
} from './thery-tour.utils';

function user(role: AuthenticatedUser['role']): AuthenticatedUser {
  return { id: 'u1', email: 'a@b.com', role, clinic_id: 'c1', is_solo: role === 'professional' };
}

function portal(level: PortalContext['access']['level']): PortalContext {
  return {
    patient: {
      id: 'p1',
      name: 'Ana Silva',
      first_name: 'Ana',
      profile_type: 'ADULT',
      active_modules: ['CLINICO_GERAL'],
      birth_date: '1990-01-01',
    },
    access: {
      level,
      link_id: 'l1',
      relationship: 'mãe',
      is_primary_contact: true,
    },
    capabilities: { companion_chat: true, can_subscribe: true },
    subscription: null,
  };
}

const sampleSteps: TheryTourStep[] = [
  {
    id: 'a',
    route: '/dashboard',
    pose: 'pointing',
    placement: 'spotlight',
    title: 'A',
    body: 'A',
    viewport: 'both',
  },
  {
    id: 'b',
    route: '/financeiro',
    pose: 'profile',
    placement: 'spotlight',
    title: 'B',
    body: 'B',
    viewport: 'desktop',
    requires: 'finance',
  },
  {
    id: 'c',
    route: '/patients/:patientId/copilot',
    pose: 'profile',
    placement: 'spotlight',
    title: 'C',
    body: 'C',
    viewport: 'both',
    requires: 'patient',
  },
  {
    id: 'd',
    route: '/settings',
    pose: 'profile',
    placement: 'spotlight',
    title: 'D',
    body: 'D',
    viewport: 'mobile',
    requires: 'owner',
  },
];

describe('resolveTourAudience', () => {
  it('espera o contexto do portal antes de decidir família', () => {
    expect(resolveTourAudience(user('family'), undefined)).toBeNull();
    expect(resolveTourAudience(user('family'), portal('SELF'))).toBe('patient');
    expect(resolveTourAudience(user('family'), portal('CAREGIVER'))).toBe('caregiver');
  });

  it('mapeia papéis clínicos', () => {
    expect(resolveTourAudience(user('professional'), undefined)).toBe('professional');
    expect(resolveTourAudience(user('clinic_admin'), undefined)).toBe('clinic_admin');
    expect(resolveTourAudience(user('master'), undefined)).toBe('clinic_admin');
  });
});

describe('selectTourSteps', () => {
  const base: TheryTourRuntimeContext = {
    audience: 'professional',
    viewport: 'desktop',
    canFinance: true,
    isOwner: true,
    patientId: 'p1',
  };

  it('remove financeiro sem permissão e paciente sem id', () => {
    const filtered = selectTourSteps(sampleSteps, { ...base, canFinance: false, patientId: null });
    expect(filtered.map((step) => step.id)).toEqual(['a']);
  });

  it('respeita viewport mobile', () => {
    const filtered = selectTourSteps(sampleSteps, { ...base, viewport: 'mobile' });
    expect(filtered.map((step) => step.id)).toEqual(['a', 'c', 'd']);
  });
});

describe('rotas e alvos', () => {
  it('substitui o paciente na rota', () => {
    expect(resolveTourRoute('/patients/:patientId/overview', 'abc')).toBe('/patients/abc/overview');
    expect(resolveTourRoute('/dashboard', null)).toBe('/dashboard');
  });

  it('casa a rota atual com o destino do passo', () => {
    expect(routeMatchesTour('/patients/abc/copilot', '/patients/abc/copilot')).toBe(true);
    expect(routeMatchesTour('/patients/abc/copilot/extra', '/patients/abc/copilot')).toBe(true);
    expect(routeMatchesTour('/patients/xyz/copilot', '/patients/abc/copilot')).toBe(false);
  });

  it('pula alvo só quando o passo tem target', () => {
    expect(shouldSkipMissingTarget(sampleSteps[0]!)).toBe(false);
    expect(
      shouldSkipMissingTarget({
        ...sampleSteps[0]!,
        target: 'nav-dashboard',
      }),
    ).toBe(true);
  });
});

describe('âncoras e recorte visual', () => {
  it('mapeia hrefs da sidebar e do portal', () => {
    expect(professionalNavTourId('/calendar')).toBe('nav-agenda');
    expect(professionalNavTourId('/session')).toBe('nav-session');
    expect(professionalNavTourId('/ajuda')).toBe('nav-ajuda');
    expect(portalNavTourId('/portal/ivy', true)).toBe('portal-thery');
    expect(portalNavTourId('/portal/diary')).toBe('portal-diary');
  });

  it('lê o viewport no breakpoint lg', () => {
    expect(readTourViewport(1024)).toBe('desktop');
    expect(readTourViewport(1023)).toBe('mobile');
  });

  it('monta o recorte do spotlight sem deslocar o alvo', () => {
    const el = document.createElement('div');
    el.getBoundingClientRect = () =>
      ({
        x: 40,
        y: 80,
        top: 80,
        left: 40,
        right: 200,
        bottom: 120,
        width: 160,
        height: 40,
        toJSON: () => ({}),
      }) as DOMRect;
    expect(spotlightRectFromElement(el, 6)).toEqual({
      top: 74,
      left: 34,
      width: 172,
      height: 52,
    });
  });

  it('ignora alvo escondido', () => {
    const hidden = document.createElement('a');
    hidden.setAttribute('data-tour', 'nav-dashboard');
    hidden.style.display = 'none';
    document.body.append(hidden);
    expect(findVisibleTourTarget('nav-dashboard')).toBeNull();
    hidden.remove();
  });

  it('ignora alvo fora da tela, mesmo com tamanho', () => {
    const off = document.createElement('a');
    off.setAttribute('data-tour', 'nav-agenda');
    off.style.position = 'fixed';
    document.body.append(off);
    off.getBoundingClientRect = () =>
      ({
        x: -300,
        y: 80,
        top: 80,
        left: -300,
        right: -12,
        bottom: 120,
        width: 288,
        height: 40,
        toJSON: () => ({}),
      }) as DOMRect;
    expect(findVisibleTourTarget('nav-agenda')).toBeNull();
    off.remove();
  });

  it('escolhe o alvo com maior área visível', () => {
    const small = document.createElement('button');
    small.setAttribute('data-tour', 'cta-new-patient');
    const large = document.createElement('button');
    large.setAttribute('data-tour', 'cta-new-patient');
    document.body.append(small, large);
    small.getBoundingClientRect = () =>
      ({
        x: 10,
        y: 10,
        top: 10,
        left: 10,
        right: 50,
        bottom: 40,
        width: 40,
        height: 30,
        toJSON: () => ({}),
      }) as DOMRect;
    large.getBoundingClientRect = () =>
      ({
        x: 80,
        y: 10,
        top: 10,
        left: 80,
        right: 220,
        bottom: 52,
        width: 140,
        height: 42,
        toJSON: () => ({}),
      }) as DOMRect;
    expect(findVisibleTourTarget('cta-new-patient')).toBe(large);
    small.remove();
    large.remove();
  });
});

describe('welcome', () => {
  it('usa o primeiro nome e o texto certo por audiência', () => {
    expect(welcomeFirstName('Ana Silva')).toBe('Ana');
    expect(welcomeCopy('professional', 'João').body).toContain('agenda');
    expect(welcomeCopy('patient', 'Ana').body).toContain('Meu dia');
  });
});
