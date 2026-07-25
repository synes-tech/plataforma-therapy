import {
  assertLiveCheckoutEnabled,
  assertStripeTestPageEnabled,
  getStripeAppOrigin,
  getStripeClient,
} from '../_shared/stripe.ts';
import { AppError } from '../_shared/errors.ts';
import type { StripeTestCreatePortalPayload } from './types.ts';

export interface StripeTestPortalResult {
  url: string;
}

export async function stripeTestCreatePortal(
  payload: StripeTestCreatePortalPayload,
  req: Request,
): Promise<StripeTestPortalResult> {
  assertStripeTestPageEnabled();

  if (payload.mode === 'live') {
    assertLiveCheckoutEnabled();
  }

  const origin = getStripeAppOrigin(req);
  const stripe = getStripeClient(payload.mode);

  const checkoutSession = await stripe.checkout.sessions.retrieve(payload.session_id);

  const customerId =
    typeof checkoutSession.customer === 'string' ? checkoutSession.customer : checkoutSession.customer?.id;

  const customerAccount =
    typeof checkoutSession.customer_account === 'string'
      ? checkoutSession.customer_account
      : (checkoutSession.customer_account as { id?: string } | null)?.id;

  let portalSession;

  if (customerAccount) {
    portalSession = await stripe.billingPortal.sessions.create({
      customer_account: customerAccount,
      return_url: `${origin}/unithery/teste?mode=${payload.mode}`,
    });
  } else if (customerId) {
    portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/unithery/teste?mode=${payload.mode}`,
    });
  } else {
    throw new AppError({
      code: 'STRIPE_CUSTOMER_NOT_FOUND',
      message: 'Sessão de checkout sem cliente associado. Finalize o pagamento antes de abrir o portal.',
      statusCode: 400,
    });
  }

  if (!portalSession.url) {
    throw new AppError({
      code: 'STRIPE_PORTAL_URL_MISSING',
      message: 'Stripe não retornou URL do portal de clientes.',
      statusCode: 500,
    });
  }

  return { url: portalSession.url };
}
