import type Stripe from 'npm:stripe@17.7.0';
import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import { getStripeClient } from '../_shared/stripe.ts';
import { getStripeBillingMode } from '../_shared/stripe-billing-config.ts';
import { getFamilyPatientLink } from '../_shared/family-access.ts';
import { unixToIso } from '../_shared/b2c-billing.ts';
import type { CancelPatientSubscriptionPayload } from './schema.ts';
import type { CancelPatientSubscriptionResponse } from './types.ts';

export async function cancelPatientSubscription(
  payload: CancelPatientSubscriptionPayload,
  caller: AuthenticatedUser,
): Promise<CancelPatientSubscriptionResponse> {
  const link = await getFamilyPatientLink(caller.id);
  if (link.access_level !== 'SELF') {
    throw new AppError({
      code: 'SUBSCRIBE_NOT_ALLOWED',
      message: 'Só o próprio paciente cancela a assinatura da Ivy.',
      statusCode: 403,
    });
  }

  const supabase = createServiceClient();
  const { data: row } = await supabase
    .from('patient_subscriptions')
    .select('id, status, stripe_subscription_id, trial_end, current_period_end, cancel_at_period_end')
    .eq('patient_id', link.patient_id)
    .in('status', ['trialing', 'active', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) {
    throw new AppError({
      code: 'NOTHING_TO_CANCEL',
      message: 'Não há assinatura ativa para cancelar.',
      statusCode: 409,
    });
  }

  const inTrial = row.status === 'trialing';
  const cancelsImmediately = inTrial || !row.stripe_subscription_id;
  const periodEnd = row.current_period_end ? new Date(row.current_period_end) : new Date();
  const effectiveAt = cancelsImmediately ? new Date() : periodEnd;

  if (payload.action === 'preview') {
    return {
      action: 'preview',
      in_trial: inTrial,
      cancels_immediately: cancelsImmediately,
      effective_at: effectiveAt.toISOString(),
      status: row.status as string,
      message: cancelsImmediately
        ? 'O período grátis será encerrado agora. Nenhuma cobrança será feita.'
        : `O acesso à Ivy segue até ${periodEnd.toLocaleDateString('pt-BR')}. Depois disso, sem nova cobrança.`,
    };
  }

  const mode = getStripeBillingMode();
  const stripe = getStripeClient(mode);

  let subscription: Stripe.Subscription | null = null;
  if (row.stripe_subscription_id) {
    try {
      subscription = await stripe.subscriptions.retrieve(row.stripe_subscription_id as string);
    } catch {
      subscription = null;
    }
  }

  if (subscription && (subscription.status === 'trialing' || subscription.status === 'active' || subscription.status === 'past_due')) {
    if (cancelsImmediately) {
      await stripe.subscriptions.cancel(subscription.id, { invoice_now: false, prorate: false });
    } else {
      await stripe.subscriptions.update(subscription.id, {
        cancel_at_period_end: true,
        metadata: { ...subscription.metadata, canceled_by: caller.id, canceled_via: 'portal' },
      });
    }
  }

  const nextStatus = cancelsImmediately ? 'canceled' : (row.status as string);
  await supabase
    .from('patient_subscriptions')
    .update({
      status: nextStatus,
      cancel_at_period_end: !cancelsImmediately,
      canceled_at: cancelsImmediately ? new Date().toISOString() : unixToIso(subscription?.canceled_at) ?? null,
    })
    .eq('id', row.id);

  try {
    await supabase.from('audit_logs').insert({
      user_id: caller.id,
      action: 'billing.patient_subscription.cancel',
      resource_type: 'patient_subscription',
      resource_id: row.id,
      metadata: {
        patient_id: link.patient_id,
        in_trial: inTrial,
        cancels_immediately: cancelsImmediately,
        stripe_subscription_id: row.stripe_subscription_id,
      },
    });
  } catch (auditErr) {
    console.error('[cancel-patient-subscription] auditoria falhou', auditErr);
  }

  return {
    action: 'confirm',
    canceled: true,
    in_trial: inTrial,
    cancels_immediately: cancelsImmediately,
    effective_at: effectiveAt.toISOString(),
    status: nextStatus,
    message: cancelsImmediately
      ? 'Assinatura cancelada. Nenhuma cobrança será feita.'
      : `Cancelamento agendado. Você mantém a Ivy até ${periodEnd.toLocaleDateString('pt-BR')}.`,
  };
}
