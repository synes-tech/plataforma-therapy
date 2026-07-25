import type { StripeBillingMode, StripeCheckoutPlanId } from './stripe-billing.constants';
import { modeLabel, planById } from './stripe-billing.constants';

interface StripeCheckoutReturnBannerProps {
  success: boolean;
  canceled: boolean;
  mode: StripeBillingMode | null;
  planId: StripeCheckoutPlanId | null;
  sessionId: string | null;
}

export function StripeCheckoutReturnBanner({
  success,
  canceled,
  mode,
  planId,
  sessionId,
}: StripeCheckoutReturnBannerProps) {
  if (!success && !canceled) return null;

  const planName = planId ? planById(planId).name : 'Plano';
  const modeText = mode ? modeLabel(mode) : 'Stripe';

  return (
    <div
      role="status"
      className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
        success
          ? 'border-mint/30 bg-mint-50 text-mint-dark'
          : 'border-amber-200 bg-amber-50 text-amber-900'
      }`}
    >
      {success ? (
        <>
          <p className="font-semibold">Pagamento confirmado</p>
          <p className="mt-1">
            {planName} · {modeText}
          </p>
        </>
      ) : (
        <>
          <p className="font-semibold">Pagamento cancelado</p>
          <p className="mt-1">Nenhuma cobrança foi realizada ({modeText}).</p>
        </>
      )}
      {sessionId && (
        <p className="mt-2 break-all text-xs opacity-80">session_id: {sessionId}</p>
      )}
    </div>
  );
}
