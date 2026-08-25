/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import type { PortalContext } from '@shared/lib/portal-context';
import { portalCelebrationFromContext, portalCheckoutUnlocked } from './portal-checkout-return';

function context(partial: Partial<PortalContext>): PortalContext {
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
      level: 'SELF',
      link_id: 'l1',
      relationship: 'self',
      is_primary_contact: true,
    },
    subscription: partial.subscription ?? null,
    capabilities: partial.capabilities ?? { companion_chat: false, can_subscribe: true },
  };
}

describe('portalCheckoutUnlocked', () => {
  it('libera quando o chat da Ivy já está autorizado', () => {
    expect(
      portalCheckoutUnlocked(context({ capabilities: { companion_chat: true, can_subscribe: false } })),
    ).toBe(true);
  });

  it('libera quando a assinatura já está ativa', () => {
    expect(
      portalCheckoutUnlocked(
        context({
          subscription: {
            status: 'trialing',
            plan_code: 'thery_apoio_mensal',
            active: true,
            trial_end: '2026-08-31T12:00:00.000Z',
            current_period_end: '2026-09-30T12:00:00.000Z',
            cancel_at_period_end: false,
          },
        }),
      ),
    ).toBe(true);
  });

  it('espera o webhook se ainda não houver acesso', () => {
    expect(portalCheckoutUnlocked(context({}))).toBe(false);
  });
});

describe('portalCelebrationFromContext', () => {
  it('usa trial de 7 dias com a data de cobrança do paciente', () => {
    const copy = portalCelebrationFromContext(
      context({
        subscription: {
          status: 'trialing',
          plan_code: 'thery_apoio_mensal',
          active: true,
          trial_end: '2026-08-31T12:00:00.000Z',
          current_period_end: '2026-09-30T12:00:00.000Z',
          cancel_at_period_end: false,
        },
      }),
    );
    expect(copy.isTrial).toBe(true);
    expect(copy.chargeAtIso).toBe('2026-08-31T12:00:00.000Z');
  });

  it('não trata assinatura paga como trial', () => {
    const copy = portalCelebrationFromContext(
      context({
        subscription: {
          status: 'active',
          plan_code: 'thery_apoio_mensal',
          active: true,
          trial_end: null,
          current_period_end: '2026-09-30T12:00:00.000Z',
          cancel_at_period_end: false,
        },
      }),
    );
    expect(copy.isTrial).toBe(false);
    expect(copy.chargeAtIso).toBeNull();
  });
});
