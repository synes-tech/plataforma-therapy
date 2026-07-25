import { LoadingButton } from '@containers/loading';
import type { StripeBillingMode, StripeCheckoutPlanId } from './stripe-billing.constants';

interface StripeCheckoutButtonProps {
  mode: StripeBillingMode;
  planId: StripeCheckoutPlanId;
  label: string;
  loading?: boolean;
  disabled?: boolean;
  onCheckout: (mode: StripeBillingMode, planId: StripeCheckoutPlanId) => void;
}

export function StripeCheckoutButton({
  mode,
  planId,
  label,
  loading,
  disabled,
  onCheckout,
}: StripeCheckoutButtonProps) {
  return (
    <LoadingButton
      type="button"
      variant={mode === 'live' ? 'danger' : 'dark'}
      fullWidth
      loading={loading}
      disabled={disabled}
      onClick={() => onCheckout(mode, planId)}
      className="h-11 text-sm font-semibold"
    >
      {label}
    </LoadingButton>
  );
}
