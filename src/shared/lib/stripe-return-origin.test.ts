/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { resolveStripeReturnOrigin } from './stripe-return-origin';

describe('resolveStripeReturnOrigin', () => {
  it('usa localhost quando o checkout partiu do dev server', () => {
    expect(resolveStripeReturnOrigin('http://localhost:5173', 'https://unithery.com')).toBe(
      'http://localhost:5173',
    );
  });

  it('usa produção quando o checkout partiu do domínio canônico', () => {
    expect(resolveStripeReturnOrigin('https://unithery.com', 'https://unithery.com')).toBe(
      'https://unithery.com',
    );
  });

  it('cai no STRIPE_APP_ORIGIN se o Origin não for confiável', () => {
    expect(resolveStripeReturnOrigin('https://evil.example', 'https://unithery.com')).toBe(
      'https://unithery.com',
    );
  });
});
