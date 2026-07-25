import { createServiceClient } from '../_shared/supabase.ts';
import { AppError, ForbiddenError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import { assertStripeBillingEnabled, getStripeBillingMode } from '../_shared/stripe-billing-config.ts';
import { getStripeClient } from '../_shared/stripe.ts';
import { provisionFromCheckoutSession } from '../_shared/stripe-checkout-complete.ts';
import type { ConfirmStripeCheckoutPayload } from './schema.ts';
import type { ConfirmStripeCheckoutResponse } from './types.ts';

export async function confirmStripeCheckout(
  payload: ConfirmStripeCheckoutPayload,
  caller: AuthenticatedUser,
): Promise<ConfirmStripeCheckoutResponse> {
  assertStripeBillingEnabled();

  if (!caller.clinic_id) {
    throw new ForbiddenError('Usuário sem clínica associada');
  }

  const stripe = getStripeClient(getStripeBillingMode());
  const session = await stripe.checkout.sessions.retrieve(payload.session_id, {
    expand: ['subscription'],
  });

  if (session.metadata?.clinic_id !== caller.clinic_id) {
    throw new ForbiddenError('Sessão de checkout não pertence a esta clínica');
  }

  await provisionFromCheckoutSession(
    stripe,
    session,
    'confirm-stripe-checkout',
  );

  const supabase = createServiceClient();
  const { data: clinic, error } = await supabase
    .from('clinics')
    .select('id, subscription_plan, subscription_status, payment_method_on_file, stripe_subscription_id')
    .eq('id', caller.clinic_id)
    .single();

  if (error || !clinic) {
    throw new AppError({
      code: 'CLINIC_NOT_FOUND',
      message: 'Clínica não encontrada após confirmação',
      statusCode: 404,
    });
  }

  return {
    clinic_id: clinic.id as string,
    plan_id: clinic.subscription_plan as string,
    subscription_status: clinic.subscription_status as string,
    payment_method_on_file: Boolean(clinic.payment_method_on_file),
    stripe_subscription_id: (clinic.stripe_subscription_id as string | null) ?? null,
  };
}
