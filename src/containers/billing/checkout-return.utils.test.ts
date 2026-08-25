/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { checkoutLooksActive, checkoutReturnFromError } from './checkout-return.utils';

describe('checkoutReturnFromError', () => {
  it('para o polling quando a sessão é de outra conta', () => {
    expect(checkoutReturnFromError({ code: 'FORBIDDEN', message: 'x' })).toBe('mismatch');
  });

  it('continua tentando em erro transitório', () => {
    expect(checkoutReturnFromError(new Error('network'))).toBe('retry');
  });
});

describe('checkoutLooksActive', () => {
  it('reconhece trial e assinatura ativa', () => {
    expect(checkoutLooksActive({ subscription_status: 'trial_active' })).toBe(true);
    expect(checkoutLooksActive({ subscription_status: 'active' })).toBe(true);
    expect(checkoutLooksActive({ requires_paywall: false })).toBe(true);
    expect(checkoutLooksActive({ subscription_status: 'canceled' })).toBe(false);
  });
});
