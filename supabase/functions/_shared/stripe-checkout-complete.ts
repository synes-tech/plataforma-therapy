import type Stripe from 'npm:stripe@17.7.0';
import { AppError } from './errors.ts';
import {
  computeCommitmentEnd,
  provisionClinicFromStripe,
  syncAddonsFromSubscription,
  type DbSubscriptionStatus,
} from './stripe-billing-provision.ts';

export async function provisionFromCheckoutSession(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  source: string,
  stripeEventId?: string,
): Promise<void> {
  if (session.metadata?.source !== 'unithery_billing') {
    throw new AppError({
      code: 'CHECKOUT_SESSION_INVALID',
      message: 'Sessão de checkout não pertence à plataforma',
      statusCode: 400,
    });
  }

  // Trial de 14 dias: payment_status = 'no_payment_required' com status 'complete'
  if (session.payment_status !== 'paid' && session.status !== 'complete') {
    throw new AppError({
      code: 'CHECKOUT_NOT_PAID',
      message: 'Pagamento ainda não confirmado pelo Stripe',
      statusCode: 409,
    });
  }

  const clinicId = session.metadata?.clinic_id;
  const planId = session.metadata?.plan_id;
  const userId = session.metadata?.user_id;
  const billingCycle =
    (session.metadata?.billing_cycle as 'monthly' | 'yearly' | undefined) ?? 'monthly';

  if (!clinicId || !planId) {
    throw new AppError({
      code: 'WEBHOOK_METADATA_MISSING',
      message: 'Sessão sem clinic_id/plan_id',
      statusCode: 400,
    });
  }

  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id;
  let subscriptionId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

  if (!customerId) {
    throw new AppError({
      code: 'WEBHOOK_CUSTOMER_MISSING',
      message: 'Sessão sem customer',
      statusCode: 400,
    });
  }

  if (!subscriptionId && session.mode === 'subscription') {
    const expanded = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ['subscription'],
    });
    const sub = expanded.subscription;
    subscriptionId = typeof sub === 'string' ? sub : sub?.id;
  }

  // Estado real da assinatura: trial de 14 dias → trial_active; senão → active
  let dbStatus: DbSubscriptionStatus = 'active';
  let trialEndsAt: string | null | undefined = undefined;
  let subscription: Stripe.Subscription | null = null;

  if (subscriptionId) {
    subscription = await stripe.subscriptions.retrieve(subscriptionId);
    if (subscription.status === 'trialing') {
      dbStatus = 'trial_active';
      trialEndsAt = subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null;
    }
  }

  // Compromisso anual (12x emulado): 12 meses a partir do fim do trial (ou de agora)
  const commitmentEndsAt =
    billingCycle === 'yearly'
      ? computeCommitmentEnd(
          subscription?.trial_end ? new Date(subscription.trial_end * 1000) : new Date(),
        ).toISOString()
      : null;

  await provisionClinicFromStripe({
    clinicId,
    planId,
    customerId,
    subscriptionId: subscriptionId ?? null,
    dbStatus,
    source,
    stripeEventId,
    initiatedByUserId: userId,
    billingCycle,
    trialEndsAt,
    commitmentEndsAt,
    markTrialUsed: true,
  });

  if (subscription) {
    await syncAddonsFromSubscription(clinicId, subscription);
  }
}
