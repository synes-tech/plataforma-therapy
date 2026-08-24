/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import type { PortalContext } from './portal-context';
import { isPortalTheryPath, portalNavItems, PORTAL_ROUTES } from './portal-nav';

function portal(partial: Partial<PortalContext> = {}): PortalContext {
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
      level: 'CAREGIVER',
      link_id: 'l1',
      relationship: 'mãe',
      is_primary_contact: true,
    },
    capabilities: { companion_chat: false, can_subscribe: false },
    subscription: null,
    ...partial,
  };
}

describe('portalNavItems', () => {
  it('cuidador não vê a Ivy', () => {
    expect(portalNavItems(portal()).map((i) => i.label)).toEqual([
      'Diário',
      'Calendário',
      'Relatórios e Combinados',
      'Ajuda',
    ]);
  });

  it('paciente vê Ivy no centro, com ou sem assinatura', () => {
    const items = portalNavItems(portal({ access: { ...portal().access, level: 'SELF' } }));
    expect(items.map((i) => i.label)).toEqual([
      'Meu dia',
      'Histórico',
      'Ivy',
      'Plano de cuidados',
      'Ajuda',
    ]);
    expect(items[2]?.featured).toBe(true);
    expect(items[2]?.href).toBe(PORTAL_ROUTES.companion);
  });
});

describe('isPortalTheryPath', () => {
  it('reconhece a rota canônica e o alias legado', () => {
    expect(isPortalTheryPath(PORTAL_ROUTES.companion)).toBe(true);
    expect(isPortalTheryPath('/portal/apoio')).toBe(true);
    expect(isPortalTheryPath('/portal/thery')).toBe(true);
    expect(isPortalTheryPath('/portal/diary')).toBe(false);
  });
});
