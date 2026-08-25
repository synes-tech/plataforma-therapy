export type CheckoutReturnPoll = 'ready' | 'mismatch' | 'retry';

export function checkoutReturnFromError(err: unknown): CheckoutReturnPoll {
  const code =
    err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
  if (code === 'FORBIDDEN') return 'mismatch';
  return 'retry';
}

export function checkoutLooksActive(result: {
  subscription_status?: string;
  payment_method_on_file?: boolean;
  requires_paywall?: boolean;
}): boolean {
  if (result.requires_paywall === false) return true;
  return (
    result.subscription_status === 'active' ||
    result.subscription_status === 'trial_active' ||
    result.payment_method_on_file === true
  );
}
