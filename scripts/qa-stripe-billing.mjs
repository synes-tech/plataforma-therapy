#!/usr/bin/env node
/**
 * QA E2E — Stripe billing produção (Fase 4)
 * Executa: node scripts/qa-stripe-billing.mjs
 */
import pg from 'pg';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL;
const STRIPE_SK = process.env.STRIPE_TEST_SECRET_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const TEST_CLINIC_ID = 'f62d0dce-f5ad-4f30-ae32-4d7429827b17';
const TEST_USER_EMAIL = 'joao@teste.com';

function requireEnv(name, value) {
  if (!value) {
    console.error(`❌ ${name} ausente. Configure no .env antes de rodar este script.`);
    process.exit(1);
  }
  return value;
}

requireEnv('SUPABASE_URL', SUPABASE_URL);
requireEnv('SUPABASE_SERVICE_ROLE_KEY', SERVICE_KEY);
requireEnv('DATABASE_URL', DATABASE_URL);
requireEnv('STRIPE_TEST_SECRET_KEY', STRIPE_SK);
requireEnv('CRON_SECRET', CRON_SECRET);

const stripe = new Stripe(STRIPE_SK, { apiVersion: '2025-01-27.acacia' });
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const results = [];

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  results.push({ name, ok: false, detail });
  console.error(`❌ ${name}${detail ? ` — ${detail}` : ''}`);
}

async function getAccessToken() {
  const { data: linkData, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: TEST_USER_EMAIL,
    options: { redirectTo: 'http://localhost:5173/dashboard' },
  });
  if (error) throw error;

  const tokenHash = linkData.properties?.hashed_token;
  if (!tokenHash) throw new Error('hashed_token ausente no generateLink');

  const { data: sessionData, error: otpError } = await admin.auth.verifyOtp({
    type: 'magiclink',
    token_hash: tokenHash,
  });
  if (otpError) throw otpError;
  return sessionData.session.access_token;
}

async function main() {
  const pgClient = new pg.Client({ connectionString: DATABASE_URL });
  await pgClient.connect();

  const backup = await pgClient.query(
    `SELECT subscription_status, payment_method_on_file, stripe_customer_id, stripe_subscription_id FROM clinics WHERE id = $1`,
    [TEST_CLINIC_ID],
  );
  const before = backup.rows[0];

  try {
    await pgClient.query(
      `UPDATE clinics SET subscription_status = 'trialing', payment_method_on_file = false, stripe_customer_id = NULL, stripe_subscription_id = NULL WHERE id = $1`,
      [TEST_CLINIC_ID],
    );

    const token = await getAccessToken();
    pass('Auth JWT gerado', TEST_USER_EMAIL);

    const checkoutRes = await fetch(`${SUPABASE_URL}/functions/v1/create-stripe-checkout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ plan_id: 'inicial' }),
    });
    const checkoutBody = await checkoutRes.json();

    if (!checkoutRes.ok || !checkoutBody?.data?.url) {
      fail('create-stripe-checkout', JSON.stringify(checkoutBody));
    } else {
      pass('create-stripe-checkout', checkoutBody.data.session_id);
    }

    const spoofRes = await fetch(`${SUPABASE_URL}/functions/v1/stripe-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'checkout.session.completed' }),
    });
    if (spoofRes.status === 400) {
      pass('Webhook rejeita assinatura inválida', '400');
    } else {
      fail('Webhook spoofing', `status ${spoofRes.status}`);
    }

    const customer = await stripe.customers.create({
      email: TEST_USER_EMAIL,
      metadata: { clinic_id: TEST_CLINIC_ID, qa: 'true' },
    });
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: 'price_1TtyetAXhFKHrqfcLwcQ5r2e' }],
      metadata: { clinic_id: TEST_CLINIC_ID, plan_id: 'inicial' },
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    });

    const paymentIntent = subscription.latest_invoice?.payment_intent;
    const piId = typeof paymentIntent === 'string' ? paymentIntent : paymentIntent?.id;
    const pm = await stripe.paymentMethods.create({ type: 'card', card: { token: 'tok_visa' } });
    await stripe.paymentMethods.attach(pm.id, { customer: customer.id });
    await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: pm.id } });
    if (piId) {
      await stripe.paymentIntents.confirm(piId, { payment_method: pm.id });
    }

    const activeSub = await stripe.subscriptions.retrieve(subscription.id);
    pass('Assinatura Stripe test criada', activeSub.status);

    console.log('⏳ Aguardando webhooks reais do Stripe (até 20s)…');
    let provisioned = false;
    for (let i = 0; i < 10; i += 1) {
      await new Promise((r) => setTimeout(r, 2000));
      const row = await pgClient.query(
        `SELECT subscription_status, stripe_subscription_id FROM clinics WHERE id = $1`,
        [TEST_CLINIC_ID],
      );
      if (row.rows[0]?.subscription_status === 'active' && row.rows[0]?.stripe_subscription_id) {
        provisioned = true;
        pass('Webhook real do Stripe provisionou', row.rows[0].stripe_subscription_id);
        break;
      }
    }
    if (!provisioned) {
      fail('Webhook real do Stripe', 'timeout aguardando active');
    }

    const paywallRes = await fetch(`${SUPABASE_URL}/functions/v1/get-paywall-state`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    const paywallBody = await paywallRes.json();
    if (paywallBody?.data?.requires_paywall === false) {
      pass('Paywall liberado', 'requires_paywall=false');
    } else {
      fail('Paywall liberado', JSON.stringify(paywallBody?.data));
    }

    await stripe.subscriptions.cancel(activeSub.id);
    await new Promise((r) => setTimeout(r, 3000));

    const syncRes = await fetch(`${SUPABASE_URL}/functions/v1/sync-stripe-subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Cron-Secret': CRON_SECRET,
      },
      body: JSON.stringify({ source: 'qa-script' }),
    });
    const syncBody = await syncRes.json();

    if (syncRes.ok) {
      pass('sync-stripe-subscriptions', JSON.stringify(syncBody.data));
    } else {
      fail('sync-stripe-subscriptions', JSON.stringify(syncBody));
    }

    await new Promise((r) => setTimeout(r, 1000));

    const afterSync = await pgClient.query(
      `SELECT subscription_status FROM clinics WHERE id = $1`,
      [TEST_CLINIC_ID],
    );

    if (afterSync.rows[0]?.subscription_status === 'canceled') {
      pass('Acesso revogado após sync', 'canceled');
    } else {
      fail('Status após cancel+sync', afterSync.rows[0]?.subscription_status);
    }
  } finally {
    await pgClient.query(
      `UPDATE clinics SET subscription_status = $2, payment_method_on_file = $3, stripe_customer_id = $4, stripe_subscription_id = $5 WHERE id = $1`,
      [
        TEST_CLINIC_ID,
        before.subscription_status,
        before.payment_method_on_file,
        before.stripe_customer_id,
        before.stripe_subscription_id,
      ],
    );
    await pgClient.end();
    console.log('\n↩️  Clínica de teste restaurada ao estado original.');
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} testes passaram`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error('FATAL', err);
  process.exit(1);
});
