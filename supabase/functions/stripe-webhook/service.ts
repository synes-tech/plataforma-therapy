import Stripe from 'npm:stripe@17.7.0';
import { createServiceClient } from '../_shared/supabase.ts';
import { getStripeClient } from '../_shared/stripe.ts';
import {
  billingWebhookSecretForMode,
  getStripeBillingMode,
} from '../_shared/stripe-billing-config.ts';
import {
  findClinicByStripeRefs,
  mapStripeSubscriptionStatus,
  paymentMethodOnFileForStatus,
  syncClinicFromStripeSubscription,
} from '../_shared/stripe-billing-provision.ts';
import { provisionFromCheckoutSession } from '../_shared/stripe-checkout-complete.ts';
import { sendSesEmail } from '../_shared/aws-ses.ts';
import { notifyBillingPlanChanged, notifyBillingWelcome } from '../_shared/billing-email.ts';
import {
  claimStripeWebhookEvent,
  findPatientSubscriptionRefs,
  invoiceSubscriptionId,
  markStripeWebhookEvent,
  resolveStripeAccountType,
  upsertPatientSubscription,
  type StripeAccountType,
} from '../_shared/b2c-billing.ts';
import {
  notifyPatientTheryWelcome,
  notifyPatientTrialEnding,
} from '../_shared/b2c-billing-email.ts';

const cryptoProvider = Stripe.createSubtleCryptoProvider();

export async function handleStripeBillingWebhook(req: Request): Promise<Response> {
  const mode = getStripeBillingMode();
  const stripe = getStripeClient(mode);
  const endpointSecret = billingWebhookSecretForMode(mode);

  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      endpointSecret,
      undefined,
      cryptoProvider,
    );
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed', err);
    return new Response('Webhook signature verification failed', { status: 400 });
  }

  try {
    event = await stripe.events.retrieve(event.id);
  } catch (err) {
    console.error('[stripe-webhook] event retrieve failed', err);
    return new Response('Webhook event verification failed', { status: 400 });
  }

  try {
    await processStripeBillingEvent(stripe, event);
  } catch (err) {
    console.error(`[stripe-webhook] handler error for ${event.type}`, err);
    await markStripeWebhookEvent(
      event.id,
      'failed',
      err instanceof Error ? err.message : String(err),
    ).catch(() => undefined);
    return new Response('Webhook handler failed', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function metadataOf(obj: { metadata?: Stripe.Metadata | null } | null | undefined): Record<string, string> {
  return { ...(obj?.metadata ?? {}) };
}

async function resolveEventAccountType(
  stripe: Stripe,
  event: Stripe.Event,
): Promise<StripeAccountType> {
  const object = event.data.object as {
    metadata?: Stripe.Metadata | null;
    customer?: string | { id: string } | null;
    subscription?: string | { id: string } | null;
    id?: string;
  };

  const fromObject = resolveStripeAccountType(metadataOf(object));
  if (fromObject !== 'unknown') return fromObject;

  if (event.type.startsWith('invoice.')) {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = invoiceSubscriptionId(invoice);
    if (subscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const fromSub = resolveStripeAccountType(metadataOf(subscription));
        if (fromSub !== 'unknown') return fromSub;
      } catch {
        /* lookup local abaixo */
      }
    }
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    const patient = await findPatientSubscriptionRefs(customerId, subscriptionId);
    if (patient) return 'patient';
    const clinic = await findClinicByStripeRefs(customerId, subscriptionId);
    if (clinic) return 'clinic';
  }

  if (event.type.startsWith('customer.subscription.')) {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId =
      typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
    const patient = await findPatientSubscriptionRefs(customerId, subscription.id);
    if (patient) return 'patient';
    const clinic = await findClinicByStripeRefs(customerId, subscription.id);
    if (clinic) return 'clinic';
  }

  return 'unknown';
}

async function processStripeBillingEvent(
  stripe: Stripe,
  event: Stripe.Event,
): Promise<void> {
  const accountType = await resolveEventAccountType(stripe, event);
  const claim = await claimStripeWebhookEvent({
    eventId: event.id,
    eventType: event.type,
    accountType,
    livemode: event.livemode,
  });

  if (claim === 'duplicate') {
    console.log(`[stripe-webhook] skip duplicate ${event.id} ${event.type}`);
    return;
  }

  const eventType =
    (event.type as string) === 'invoice.payment_succeeded' ? 'invoice.paid' : event.type;

  switch (eventType) {
    case 'checkout.session.completed':
      if (accountType === 'patient') {
        await handlePatientCheckoutCompleted(stripe, event);
      } else {
        await handleClinicCheckoutSessionCompleted(stripe, event);
      }
      break;
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      if (accountType === 'patient') {
        await handlePatientSubscriptionChange(stripe, event);
      } else {
        await handleClinicSubscriptionChange(event);
      }
      break;
    case 'customer.subscription.trial_will_end':
      if (accountType === 'patient') {
        await handlePatientTrialWillEnd(event);
      } else {
        await handleClinicTrialWillEnd(event);
      }
      break;
    case 'invoice.payment_failed':
      if (accountType === 'patient') {
        await handlePatientInvoicePaymentFailed(stripe, event);
      } else {
        await handleClinicInvoicePaymentFailed(event);
      }
      break;
    case 'invoice.paid':
      if (accountType === 'patient') {
        await handlePatientInvoicePaid(stripe, event);
      } else {
        await handleClinicInvoicePaid(stripe, event);
      }
      break;
    default:
      await markStripeWebhookEvent(event.id, 'ignored');
      console.log(`[stripe-webhook] ignored event ${event.type}`);
      return;
  }

  await markStripeWebhookEvent(event.id, 'processed');
}

async function resolvePatientFromMetadata(
  metadata: Record<string, string>,
  customerId: string | null,
  subscriptionId: string | null,
): Promise<{
  patientId: string;
  clinicId: string;
  portalLinkId: string | null;
  userId: string | null;
} | null> {
  if (metadata.patient_id && metadata.clinic_id) {
    return {
      patientId: metadata.patient_id,
      clinicId: metadata.clinic_id,
      portalLinkId: metadata.portal_link_id ?? null,
      userId: metadata.user_id ?? null,
    };
  }

  const refs = await findPatientSubscriptionRefs(customerId, subscriptionId);
  if (!refs) return null;
  return {
    patientId: refs.patient_id,
    clinicId: refs.clinic_id,
    portalLinkId: refs.portal_link_id,
    userId: refs.user_id,
  };
}

async function syncPatientFromStripe(
  stripe: Stripe,
  params: {
    metadata: Record<string, string>;
    customerId: string | null;
    subscriptionId: string | null;
  },
): Promise<void> {
  if (!params.subscriptionId || !params.customerId) return;
  const identity = await resolvePatientFromMetadata(
    params.metadata,
    params.customerId,
    params.subscriptionId,
  );
  if (!identity) {
    console.log('[stripe-webhook] patient sync — paciente não resolvido');
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(params.subscriptionId);
  await upsertPatientSubscription({
    patientId: identity.patientId,
    clinicId: identity.clinicId,
    portalLinkId: identity.portalLinkId,
    userId: identity.userId,
    customerId: params.customerId,
    subscription,
  });
}

async function handlePatientCheckoutCompleted(
  stripe: Stripe,
  event: Stripe.Event,
): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;
  const metadata = metadataOf(session);
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
  let subscriptionId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

  if (!subscriptionId && session.mode === 'subscription') {
    const expanded = await stripe.checkout.sessions.retrieve(session.id, { expand: ['subscription'] });
    const sub = expanded.subscription;
    subscriptionId = typeof sub === 'string' ? sub : sub?.id;
  }

  await syncPatientFromStripe(stripe, { metadata, customerId: customerId ?? null, subscriptionId: subscriptionId ?? null });

  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await notifyPatientTheryWelcome({
      userId: metadata.user_id ?? null,
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
    }).catch((err) => {
      console.error('[stripe-webhook] e-mail de boas-vindas B2C falhou', err);
    });
  }

  console.log(`[stripe-webhook] provisioned patient=${metadata.patient_id}`);
}

async function handlePatientSubscriptionChange(
  stripe: Stripe,
  event: Stripe.Event,
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
  await syncPatientFromStripe(stripe, {
    metadata: metadataOf(subscription),
    customerId: customerId ?? null,
    subscriptionId: subscription.id,
  });
}

async function handlePatientTrialWillEnd(event: Stripe.Event): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const metadata = metadataOf(subscription);
  await notifyPatientTrialEnding({
    userId: metadata.user_id ?? null,
    trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
    daysBefore: 3,
  }).catch((err) => {
    console.error('[stripe-webhook] trial_will_end B2C falhou', err);
  });
}

async function handlePatientInvoicePaid(stripe: Stripe, event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  const subscriptionId = invoiceSubscriptionId(invoice);
  await syncPatientFromStripe(stripe, {
    metadata: metadataOf(invoice),
    customerId: customerId ?? null,
    subscriptionId,
  });
}

async function handlePatientInvoicePaymentFailed(stripe: Stripe, event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId || !customerId) return;

  const identity = await resolvePatientFromMetadata(metadataOf(invoice), customerId, subscriptionId);
  if (!identity) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await upsertPatientSubscription({
    patientId: identity.patientId,
    clinicId: identity.clinicId,
    portalLinkId: identity.portalLinkId,
    userId: identity.userId,
    customerId,
    subscription: { ...subscription, status: 'past_due' },
  });
}

async function handleClinicCheckoutSessionCompleted(
  stripe: Stripe,
  event: Stripe.Event,
): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;
  await provisionFromCheckoutSession(
    stripe,
    session,
    'stripe-webhook:checkout.session.completed',
    event.id,
  );
  console.log(`[stripe-webhook] provisioned clinic=${session.metadata?.clinic_id}`);

  const clinicId = session.metadata?.clinic_id;
  const planId = session.metadata?.plan_id;
  const billingCycle = session.metadata?.billing_cycle as 'monthly' | 'yearly' | undefined;
  if (clinicId && planId) {
    try {
      await notifyBillingWelcome({
        clinicId,
        planId,
        billingCycle: billingCycle ?? 'monthly',
      });
    } catch (err) {
      console.error('[stripe-webhook] falha ao enviar e-mail de boas-vindas', err);
    }
  }
}

async function handleClinicSubscriptionChange(event: Stripe.Event): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id;

  const clinic = await findClinicByStripeRefs(customerId, subscription.id);
  const clinicId = clinic?.id ?? subscription.metadata?.clinic_id;
  const previousPlanId = clinic?.subscription_plan ?? null;
  const nextPlanId = (subscription.metadata?.plan_id as string | undefined) ?? previousPlanId;
  const billingCycle = subscription.metadata?.billing_cycle as 'monthly' | 'yearly' | undefined;

  if (!clinicId) {
    console.log('[stripe-webhook] subscription change — clínica não encontrada');
    return;
  }

  await syncClinicFromStripeSubscription(
    clinicId,
    subscription,
    `stripe-webhook:${event.type}`,
  );

  if (
    event.type === 'customer.subscription.updated' &&
    nextPlanId &&
    previousPlanId &&
    previousPlanId !== nextPlanId
  ) {
    try {
      await notifyBillingPlanChanged({
        clinicId,
        previousPlanId,
        nextPlanId,
        billingCycle: billingCycle ?? 'monthly',
      });
    } catch (err) {
      console.error('[stripe-webhook] falha ao enviar e-mail de alteração de plano', err);
    }
  }
}

async function handleClinicTrialWillEnd(event: Stripe.Event): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id;

  const clinic = await findClinicByStripeRefs(customerId, subscription.id);
  if (!clinic) {
    console.log('[stripe-webhook] trial_will_end — clínica não encontrada');
    return;
  }

  const supabase = createServiceClient();
  const { data: clinicRow } = await supabase
    .from('clinics')
    .select('email, name')
    .eq('id', clinic.id)
    .maybeSingle();

  if (!clinicRow?.email) return;

  const trialEnd = subscription.trial_end
    ? new Date(subscription.trial_end * 1000).toLocaleDateString('pt-BR')
    : 'em breve';
  const amountCents = subscription.items?.data?.reduce(
    (sum, item) => sum + (item.price?.unit_amount ?? 0) * (item.quantity ?? 1),
    0,
  ) ?? 0;
  const amount = (amountCents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  try {
    await sendSesEmail({
      to: clinicRow.email as string,
      subject: 'Seu período gratuito na Unithery termina em 3 dias',
      html: `<p>Olá, ${clinicRow.name ?? ''}!</p>
<p>Seu período gratuito de 14 dias termina em <strong>${trialEnd}</strong>. A partir dessa data, a cobrança de <strong>${amount}</strong> será feita automaticamente no cartão cadastrado.</p>
<p>Se não quiser continuar, cancele antes dessa data em <em>Configurações → Plano → Cancelar plano e revogar método de pagamento</em> — sem nenhuma cobrança.</p>
<p>Equipe Unithery</p>`,
      text: `Seu período gratuito de 14 dias termina em ${trialEnd}. A partir dessa data, a cobrança de ${amount} será feita automaticamente no cartão cadastrado. Para cancelar sem custo, acesse Configurações → Plano → Cancelar plano e revogar método de pagamento antes dessa data.`,
    });
    console.log(`[stripe-webhook] trial_will_end e-mail enviado clinic=${clinic.id}`);
  } catch (err) {
    console.error('[stripe-webhook] falha ao enviar e-mail de trial_will_end', err);
  }
}

async function handleClinicInvoicePaid(stripe: Stripe, event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  const subscriptionId = invoiceSubscriptionId(invoice);

  if (!subscriptionId) return;

  const clinic = await findClinicByStripeRefs(customerId, subscriptionId);
  if (!clinic) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await syncClinicFromStripeSubscription(
    clinic.id,
    subscription,
    'stripe-webhook:invoice.paid',
  );
}

async function handleClinicInvoicePaymentFailed(event: Stripe.Event): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  const subscriptionId = invoiceSubscriptionId(invoice);

  const clinic = await findClinicByStripeRefs(customerId, subscriptionId);
  if (!clinic) {
    console.log('[stripe-webhook] invoice.payment_failed — clínica não encontrada');
    return;
  }

  const supabase = createServiceClient();
  const dbStatus = mapStripeSubscriptionStatus('past_due');

  await supabase
    .from('clinics')
    .update({
      subscription_status: dbStatus,
      payment_method_on_file: paymentMethodOnFileForStatus(dbStatus),
    })
    .eq('id', clinic.id);

  await supabase.from('clinic_subscriptions').insert({
    clinic_id: clinic.id,
    plan: clinic.subscription_plan,
    status: dbStatus,
    metadata: {
      stripe: true,
      source: 'stripe-webhook:invoice.payment_failed',
      stripe_event_id: event.id,
    },
  });

  console.log(`[stripe-webhook] past_due clinic=${clinic.id}`);
}
