import { createServiceClient } from '../_shared/supabase.ts';
import { assertCronAuth } from '../_shared/cron-auth.ts';
import { getStripeClient } from '../_shared/stripe.ts';
import { getStripeBillingMode } from '../_shared/stripe-billing-config.ts';
import {
  mapStripeSubscriptionStatus,
  paymentMethodOnFileForStatus,
  syncClinicFromStripeSubscription,
} from '../_shared/stripe-billing-provision.ts';

export interface SyncStripeSubscriptionsResponse {
  scanned: number;
  updated: number;
  errors: number;
}

export async function syncStripeSubscriptions(req: Request): Promise<SyncStripeSubscriptionsResponse> {
  assertCronAuth(req);

  const supabase = createServiceClient();
  const mode = getStripeBillingMode();
  const stripe = getStripeClient(mode);

  const { data: clinics, error } = await supabase
    .from('clinics')
    .select('id, stripe_subscription_id, subscription_status, subscription_plan')
    .not('stripe_subscription_id', 'is', null)
    .in('subscription_status', ['active', 'trial_active', 'past_due', 'trialing'])
    .is('deleted_at', null);

  if (error) {
    throw error;
  }

  let updated = 0;
  let errors = 0;

  for (const clinic of clinics ?? []) {
    const subscriptionId = clinic.stripe_subscription_id as string;
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const expectedStatus = mapStripeSubscriptionStatus(subscription.status);
      if (!expectedStatus) continue;

      const currentStatus = clinic.subscription_status as string;

      if (expectedStatus !== currentStatus) {
        await syncClinicFromStripeSubscription(
          clinic.id as string,
          subscription,
          'sync-stripe-subscriptions',
        );
        updated += 1;
        console.log(
          `[sync-stripe] clinic=${clinic.id} ${currentStatus} → ${expectedStatus}`,
        );
      } else {
        // Cancelamento agendado via plataforma: cartão já foi revogado —
        // não reativar payment_method_on_file enquanto aguarda o fim do período.
        const paymentOnFile = subscription.cancel_at_period_end
          ? false
          : paymentMethodOnFileForStatus(expectedStatus);
        await supabase
          .from('clinics')
          .update({ payment_method_on_file: paymentOnFile })
          .eq('id', clinic.id);
      }
    } catch (err) {
      errors += 1;
      console.error(`[sync-stripe] failed clinic=${clinic.id}`, err);
    }
  }

  return {
    scanned: clinics?.length ?? 0,
    updated,
    errors,
  };
}
