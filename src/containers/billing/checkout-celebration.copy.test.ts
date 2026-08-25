/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { checkoutCelebrationCopy, isCheckoutTrialStatus } from './checkout-celebration.copy';

describe('checkoutCelebrationCopy', () => {
  it('monta a mensagem de trial com a data da cobrança', () => {
    const copy = checkoutCelebrationCopy({
      planLabel: 'Plano Premium',
      isTrial: true,
      chargeAtIso: '2026-09-07T19:00:00.000Z',
    });
    expect(copy.title).toContain('período de teste de 14 dias');
    expect(copy.subtitle).toContain('universo Unithery');
    expect(copy.planLine).toContain('Plano Premium');
    expect(copy.warning).toContain('24 horas');
    expect(copy.warning).toContain('setembro');
  });

  it('monta a mensagem de plano pago sem trial', () => {
    const copy = checkoutCelebrationCopy({
      planLabel: 'Plano Standard',
      isTrial: false,
      chargeAtIso: null,
    });
    expect(copy.title).toContain('universo Unithery');
    expect(copy.subtitle).toContain('Plano Standard');
    expect(copy.warning).toBeNull();
  });

  it('reconhece status de trial', () => {
    expect(isCheckoutTrialStatus('trial_active')).toBe(true);
    expect(isCheckoutTrialStatus('trialing')).toBe(true);
    expect(isCheckoutTrialStatus('active')).toBe(false);
  });

  it('usa 7 dias na celebração da Ivy para o paciente', () => {
    const copy = checkoutCelebrationCopy({
      planLabel: 'Ivy — Acompanhante de Apoio',
      isTrial: true,
      chargeAtIso: '2026-08-31T12:00:00.000Z',
      trialDays: 7,
    });
    expect(copy.title).toContain('período de teste de 7 dias');
    expect(copy.title).not.toContain('14 dias');
    expect(copy.planLine).toContain('Ivy — Acompanhante de Apoio');
    expect(copy.warning).toContain('24 horas');
  });
});
