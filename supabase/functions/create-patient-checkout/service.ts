import { createServiceClient } from '../_shared/supabase.ts';
import { AppError } from '../_shared/errors.ts';
import type { AuthenticatedUser } from '../_shared/auth.ts';
import { assertLiveCheckoutEnabled, getStripeAppOrigin, getStripeClient } from '../_shared/stripe.ts';
import { assertStripeBillingEnabled, getStripeBillingMode } from '../_shared/stripe-billing-config.ts';
import { getFamilyPatientLink } from '../_shared/family-access.ts';
import { getPortalContext } from '../get-portal-context/service.ts';
import {
  B2C_CHECKOUT_SOURCE,
  resolveTheryPriceId,
  THERY_AMOUNT_CENTS,
  THERY_PLAN_CODE,
  THERY_TRIAL_DAYS,
} from '../_shared/b2c-billing.ts';
import type { CreatePatientCheckoutPayload } from './schema.ts';
import type { CreatePatientCheckoutResponse } from './types.ts';

async function getOrCreatePatientCustomer(
  params: {
    patientId: string;
    clinicId: string;
    email: string;
    name: string;
  },
  stripe: ReturnType<typeof getStripeClient>,
): Promise<string> {
  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from('patient_subscriptions')
    .select('stripe_customer_id')
    .eq('patient_id', params.patientId)
    .not('stripe_customer_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.stripe_customer_id) return existing.stripe_customer_id as string;

  const customer = await stripe.customers.create({
    email: params.email || undefined,
    name: params.name,
    metadata: {
      account_type: 'patient',
      patient_id: params.patientId,
      clinic_id: params.clinicId,
    },
  });

  return customer.id;
}

export async function createPatientCheckout(
  payload: CreatePatientCheckoutPayload,
  caller: AuthenticatedUser,
  req: Request,
): Promise<CreatePatientCheckoutResponse> {
  assertStripeBillingEnabled();

  const link = await getFamilyPatientLink(caller.id);
  const context = await getPortalContext(caller);

  if (!context.capabilities.can_subscribe) {
    throw new AppError({
      code: context.subscription?.active ? 'ALREADY_SUBSCRIBED' : 'SUBSCRIBE_NOT_ALLOWED',
      message: context.subscription?.active
        ? 'Você já tem o Acompanhante ativo.'
        : 'A assinatura da Ivy é exclusiva para pacientes adultos com acesso próprio.',
      statusCode: 403,
    });
  }

  const supabase = createServiceClient();
  const { data: patient, error } = await supabase
    .from('patients')
    .select('id, clinic_id, name')
    .eq('id', link.patient_id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !patient) {
    throw new AppError({
      code: 'PATIENT_NOT_FOUND',
      message: 'Paciente não encontrado',
      statusCode: 404,
    });
  }

  const { data: usedTrial } = await supabase
    .from('patient_subscriptions')
    .select('id')
    .eq('patient_id', patient.id)
    .not('trial_end', 'is', null)
    .limit(1)
    .maybeSingle();

  const mode = getStripeBillingMode();
  if (mode === 'live') assertLiveCheckoutEnabled();

  const stripe = getStripeClient(mode);
  const priceId = await resolveTheryPriceId(stripe, mode);
  const origin = getStripeAppOrigin(req);
  const successPath = payload.success_path ?? '/portal/agreements';
  const customerId = await getOrCreatePatientCustomer(
    {
      patientId: patient.id as string,
      clinicId: patient.clinic_id as string,
      email: caller.email,
      name: (patient.name as string) || caller.email,
    },
    stripe,
  );

  const metadata = {
    source: B2C_CHECKOUT_SOURCE,
    account_type: 'patient',
    patient_id: patient.id as string,
    clinic_id: patient.clinic_id as string,
    portal_link_id: link.link_id,
    user_id: caller.id,
    plan_code: THERY_PLAN_CODE,
    stripe_mode: mode,
  };

  const grantTrial = !usedTrial;
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    billing_address_collection: 'auto',
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    allow_promotion_codes: false,
    payment_method_collection: 'always',
    success_url: `${origin}${successPath}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}${successPath}?checkout=canceled`,
    metadata,
    subscription_data: {
      ...(grantTrial ? { trial_period_days: THERY_TRIAL_DAYS } : {}),
      metadata,
    },
  });

  if (!session.url) {
    throw new AppError({
      code: 'STRIPE_SESSION_URL_MISSING',
      message: 'Stripe não retornou URL da sessão de checkout.',
      statusCode: 500,
    });
  }

  return {
    url: session.url,
    session_id: session.id,
    plan_code: THERY_PLAN_CODE,
    price_id: priceId,
    mode,
    trial_days: grantTrial ? THERY_TRIAL_DAYS : 0,
    amount_cents: THERY_AMOUNT_CENTS,
  };
}
