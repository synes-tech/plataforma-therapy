/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  validateCheckoutForm,
  isCheckoutFormValid,
  formatCardNumber,
  formatCardExpiry,
} from './checkout.validation';

const validForm = {
  card_holder_name: 'Ana Silva',
  card_number: '4111 1111 1111 1111',
  card_expiry: '12/28',
  card_cvv: '123',
};

describe('checkout.validation', () => {
  it('formulário válido passa', () => {
    expect(isCheckoutFormValid(validForm)).toBe(true);
    expect(validateCheckoutForm(validForm)).toEqual({});
  });

  it('bloqueia CVV com menos de 3 dígitos', () => {
    const errors = validateCheckoutForm({ ...validForm, card_cvv: '12' });
    expect(errors.card_cvv).toBeTruthy();
    expect(isCheckoutFormValid({ ...validForm, card_cvv: '12' })).toBe(false);
  });

  it('bloqueia número de cartão curto', () => {
    const errors = validateCheckoutForm({ ...validForm, card_number: '1234' });
    expect(errors.card_number).toBeTruthy();
  });

  it('formata número do cartão', () => {
    expect(formatCardNumber('4111111111111111')).toBe('4111 1111 1111 1111');
  });

  it('formata validade MM/AA', () => {
    expect(formatCardExpiry('1228')).toBe('12/28');
  });
});
