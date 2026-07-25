import Stripe from 'npm:stripe@17.7.0';
import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import { getStripeClient } from '../_shared/stripe.ts';
import {
  billingWebhookSecretForMode,
  getStripeBillingMode,
} from '../_shared/stripe-billing-config.ts';
import {
  findClinicByStripeRefs,
  mapStripeSubscriptionStatus,
  paymentMethodOnFileForStatus,
  provisionClinicFromStripe,
  syncClinicFromStripeSubscription,
} from '../_shared/stripe-billing-provision.ts';
import { provisionFromCheckoutSession } from '../_shared/stripe-checkout-complete.ts';
import { sendSesEmail } from '../_shared/aws-ses.ts';

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

  // Confirma evento na API Stripe (anti-forgery)
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
    return new Response('Webhook handler failed', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function processStripeBillingEvent(
  stripe: Stripe,
  event: Stripe.Event,
): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutSessionCompleted(stripe, event);
      break;
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await handleSubscriptionChange(event);
      break;
    case 'customer.subscription.trial_will_end':
      await handleTrialWillEnd(event);
      break;
    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event);
      break;
    case 'invoice.paid':
      await handleInvoicePaid(stripe, event);
      break;
    default:
      console.log(`[stripe-webhook] ignored event ${event.type}`);
  }
}

async function handleCheckoutSessionCompleted(
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
}

async function handleSubscriptionChange(event: Stripe.Event): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id;

  const clinic = await findClinicByStripeRefs(customerId, subscription.id);

  if (!clinic) {
    const clinicIdFromMeta = subscription.metadata?.clinic_id;
    if (!clinicIdFromMeta) {
      console.log('[stripe-webhook] subscription change — clínica não encontrada');
      return;
    }
    await syncClinicFromStripeSubscription(
      clinicIdFromMeta,
      subscription,
      `stripe-webhook:${event.type}`,
    );
    return;
  }

  await syncClinicFromStripeSubscription(
    clinic.id,
    subscription,
    `stripe-webhook:${event.type}`,
  );
}

/** Aviso 3 dias antes do fim do trial: e-mail com valor e data da 1ª cobrança. */
async function handleTrialWillEnd(event: Stripe.Event): Promise<void> {
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

/** Extrai o subscription id da invoice (compatível com API antiga e nova da Stripe). */
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const legacy = (invoice as unknown as { subscription?: string | { id: string } | null })
    .subscription;
  if (typeof legacy === 'string') return legacy;
  if (legacy && typeof legacy === 'object') return legacy.id;

  const parent = (invoice as unknown as {
    parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null;
  }).parent;
  const nested = parent?.subscription_details?.subscription;
  if (typeof nested === 'string') return nested;
  if (nested && typeof nested === 'object') return nested.id;

  return null;
}

/** Pagamento recuperado (retry bem-sucedido) → reativa a assinatura no DB. */
async function handleInvoicePaid(stripe: Stripe, event: Stripe.Event): Promise<void> {
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

async function handleInvoicePaymentFailed(event: Stripe.Event): Promise<void> {
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
