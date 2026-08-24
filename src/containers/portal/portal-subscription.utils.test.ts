import { describe, expect, it } from 'vitest';
import type { PortalContext, PortalSubscription } from '@shared/lib/portal-context';
import {
  showTherySubscriptionPanel,
  subscriptionPanelCopy,
  trialDaysRemaining,
} from './portal-subscription.utils';

function context(partial: Partial<PortalContext> & { accessLevel?: 'SELF' | 'CAREGIVER' }): PortalContext {
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
      level: partial.accessLevel ?? 'SELF',
      link_id: 'l1',
      relationship: 'self',
      is_primary_contact: true,
    },
    subscription: partial.subscription ?? null,
    capabilities: partial.capabilities ?? { companion_chat: false, can_subscribe: true },
  };
}

function sub(partial: Partial<PortalSubscription>): PortalSubscription {
  return {
    status: 'trialing',
    plan_code: 'thery_apoio_mensal',
    active: true,
    trial_end: '2026-08-29T12:00:00.000Z',
    current_period_end: '2026-09-29T12:00:00.000Z',
    cancel_at_period_end: false,
    ...partial,
  };
}

describe('trialDaysRemaining', () => {
  it('arredonda para cima e nunca devolve zero se ainda falta tempo', () => {
    const now = new Date('2026-08-28T12:00:00.000Z');
    expect(trialDaysRemaining('2026-08-29T12:00:00.000Z', now)).toBe(1);
    expect(trialDaysRemaining('2026-08-22T12:00:00.000Z', now)).toBe(0);
  });
});

describe('painel de assinatura no portal', () => {
  it('não aparece para cuidador', () => {
    expect(showTherySubscriptionPanel(context({ accessLevel: 'CAREGIVER' }))).toBe(false);
  });

  it('aparece para adulto SELF que pode assinar', () => {
    expect(showTherySubscriptionPanel(context({}))).toBe(true);
  });

  it('oferece checkout com aviso de cartão e 7 dias', () => {
    const copy = subscriptionPanelCopy(null, true);
    expect(copy.cta).toBe('subscribe');
    expect(copy.body).toMatch(/7 dias/);
    expect(copy.body).toMatch(/cartão/);
    expect(copy.body).toMatch(/49,90/);
  });

  it('mostra dias restantes do trial', () => {
    const now = new Date('2026-08-26T12:00:00.000Z');
    const copy = subscriptionPanelCopy(sub({}), false, now);
    expect(copy.cta).toBe('cancel');
    expect(copy.trialDays).toBe(3);
    expect(copy.body).toMatch(/Faltam 3 dias/);
  });
});
