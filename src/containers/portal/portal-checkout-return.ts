import type { PortalContext } from '@shared/lib/portal-context';
import { isCheckoutTrialStatus } from '@containers/billing/checkout-celebration.copy';

export function portalCheckoutUnlocked(portal: PortalContext | undefined): boolean {
  return Boolean(portal?.capabilities.companion_chat || portal?.subscription?.active);
}

export function portalCelebrationFromContext(portal: PortalContext | undefined): {
  isTrial: boolean;
  chargeAtIso: string | null;
} {
  const subscription = portal?.subscription;
  const isTrial = isCheckoutTrialStatus(subscription?.status);
  return {
    isTrial,
    chargeAtIso: isTrial ? subscription?.trial_end ?? null : null,
  };
}
