#!/usr/bin/env node
/**
 * QA E2E — Planos de produção v2 (FREE/STANDARD/ADVANCED/PREMIUM)
 * Roteiro da ETAPA 5 de docs/plano-implementacao-planos-producao.md
 *
 * Uso: set -a; source .env; set +a; node scripts/qa-planos-v2.mjs
 *
 * Cobre (test mode):
 *  1  Registro novo → FREE
 *  2  Paywall FREE lista os planos pagos com preço anual
 *  3  Checkout STANDARD mensal 1ª vez → trial 14d
 *  12 2ª tentativa → sem trial
 *  3b Provisionamento de trial via webhook (trial_active, limites 10)
 *  4  Cancelar durante trial (imediato + detach + FREE + audit)
 *  7  Upgrade STANDARD→PREMIUM via Stripe (limites 30)
 *  9  Módulo adicional (+5 pacientes, item na assinatura)
 *  14 Cancelamento no Stripe → downgrade automático p/ FREE, dados preservados
 *  8  Assinatura anual (12x emulado, commitment_ends_at)
 *  8b Cancelar anual (quebra de fidelidade + invoice + detach)
 *  10 Cota de sessões soft (aviso por paciente) e 10b hard (limite total)
 *  11 Cota de IA (aviso 80%, bloqueio 100%)
 *  13 Cron sync-stripe-subscriptions
 *
 *  5/6 (fim de trial com cobrança real/falha) exigem test clocks — roteiro manual.
 */
import pg from 'pg';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL;
const STRIPE_SK = process.env.STRIPE_TEST_SECRET_KEY;
const CRON_SECRET = process.env.CRON_SECRET || 'unithery-cron-sync-20260716';

const TEST_CLINIC_ID = 'f62d0dce-f5ad-4f30-ae32-4d7429827b17';
const TEST_USER_EMAIL = 'joao@teste.com';

if (!SUPABASE_URL || !SERVICE_KEY || !DATABASE_URL || !STRIPE_SK) {
  console.error('Env obrigatória ausente (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL, STRIPE_TEST_SECRET_KEY).');
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SK, { apiVersion: '2025-01-27.acacia' });
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const db = new pg.Client({ connectionString: DATABASE_URL });

const results = [];
const pass = (name, detail = '') => {
  results.push({ name, ok: true });
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ''}`);
};
const fail = (name, detail = '') => {
  results.push({ name, ok: false });
  console.error(`❌ ${name}${detail ? ` — ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Rastreio para cleanup
const createdSubscriptions = new Set();
const createdCustomers = new Set();
let qaPatientId = null;
let qaClinicRegisteredId = null;
let qaRegisteredUserId = null;

async function getAccessToken() {
  const { data: linkData, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: TEST_USER_EMAIL,
    options: { redirectTo: 'http://localhost:5173/dashboard' },
  });
  if (error) throw error;
  const { data: sessionData, error: otpError } = await admin.auth.verifyOtp({
    type: 'magiclink',
    token_hash: linkData.properties.hashed_token,
  });
  if (otpError) throw otpError;
  return sessionData.session.access_token;
}

async function callFn(name, body, token, method = 'POST') {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
  let json = {};
  try {
    json = await res.json();
  } catch {
    /* corpo vazio */
  }
  return { status: res.status, body: json, data: json?.data, error: json?.error };
}

async function clinicRow() {
  const r = await db.query(
    `SELECT subscription_plan::text AS plan, subscription_status::text AS status,
            payment_method_on_file, billing_cycle, trial_used, trial_ends_at,
            commitment_ends_at, stripe_customer_id, stripe_subscription_id
     FROM clinics WHERE id = $1`,
    [TEST_CLINIC_ID],
  );
  return r.rows[0];
}

async function waitFor(label, predicate, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await predicate();
    if (value) return value;
    await sleep(2500);
  }
  throw new Error(`timeout aguardando: ${label}`);
}

async function resetClinicToFree() {
  await db.query(
    `UPDATE clinics SET subscription_plan = 'free', subscription_status = 'trialing',
       payment_method_on_file = false, stripe_customer_id = NULL, stripe_subscription_id = NULL,
       billing_cycle = 'monthly', trial_used = false, commitment_ends_at = NULL,
       stripe_schedule_id = NULL, trial_ends_at = NULL
     WHERE id = $1`,
    [TEST_CLINIC_ID],
  );
  await db.query(
    `UPDATE clinic_addons SET status = 'canceled', canceled_at = now() WHERE clinic_id = $1 AND status = 'active'`,
    [TEST_CLINIC_ID],
  );
  await db.query(
    `UPDATE professionals SET patient_quota_bonus = 0 WHERE clinic_id = $1`,
    [TEST_CLINIC_ID],
  );
  await db.query(`SELECT sync_clinic_settings_from_plano($1)`, [TEST_CLINIC_ID]).catch(() => {});
}

async function attachCardAsDefault(customerId) {
  const pm = await stripe.paymentMethods.create({ type: 'card', card: { token: 'tok_visa' } });
  await stripe.paymentMethods.attach(pm.id, { customer: customerId });
  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: pm.id },
  });
  return pm.id;
}

async function createSubscription({ customerId, priceId, planId, cycle, trialDays = 0 }) {
  const sub = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    metadata: { clinic_id: TEST_CLINIC_ID, plan_id: planId, billing_cycle: cycle, qa: 'v2' },
    ...(trialDays > 0
      ? { trial_period_days: trialDays }
      : { payment_behavior: 'error_if_incomplete' }),
    payment_settings: { save_default_payment_method: 'on_subscription' },
  });
  createdSubscriptions.add(sub.id);
  return sub;
}

async function main() {
  await db.connect();

  const backup = (
    await db.query(
      `SELECT subscription_plan::text, subscription_status::text, payment_method_on_file,
              billing_cycle, trial_used, trial_ends_at, commitment_ends_at,
              stripe_customer_id, stripe_subscription_id
       FROM clinics WHERE id = $1`,
      [TEST_CLINIC_ID],
    )
  ).rows[0];

  const prices = {};
  for (const row of (
    await db.query(
      `SELECT id, stripe_price_id_test, stripe_price_id_test_anual, preco_mensal_cents, preco_anual_mensal_cents FROM planos WHERE id IN ('standard','advanced','premium')`,
    )
  ).rows) {
    prices[row.id] = row;
  }

  const token = await getAccessToken();
  pass('Setup', `JWT de ${TEST_USER_EMAIL} + price IDs do banco`);

  try {
    // ============================================================
    // 1. Registro novo → FREE
    // ============================================================
    try {
      const qaEmail = `qa-planos-v2-${Date.now()}@qa.unithery.com`;
      const reg = await callFn('register-clinic', {
        account_type: 'solo',
        clinic_email: qaEmail,
        admin_name: 'QA Planos V2',
        admin_email: qaEmail,
        admin_password: 'QaPlanos#2026',
        specialty: 'Psicologia',
      });
      if (reg.status >= 300 || !reg.data?.clinic_id) {
        fail('1. Registro novo → FREE', JSON.stringify(reg.body));
      } else {
        qaClinicRegisteredId = reg.data.clinic_id;
        qaRegisteredUserId = reg.data.admin_user_id;
        const row = (
          await db.query(
            `SELECT subscription_plan::text AS plan, trial_used FROM clinics WHERE id = $1`,
            [qaClinicRegisteredId],
          )
        ).rows[0];
        const settings = (
          await db.query(
            `SELECT max_patients_per_professional, max_ai_queries_per_month FROM clinic_settings WHERE clinic_id = $1`,
            [qaClinicRegisteredId],
          )
        ).rows[0];
        if (row?.plan === 'free' && row?.trial_used === false) {
          pass('1. Registro novo → FREE', `1 paciente (settings=${settings?.max_patients_per_professional}), IA/mês=${settings?.max_ai_queries_per_month}`);
        } else {
          fail('1. Registro novo → FREE', JSON.stringify({ row, settings }));
        }
      }
    } catch (e) {
      fail('1. Registro novo → FREE', e.message);
    }

    // ============================================================
    // 2. Paywall no FREE lista planos pagos com preço anual
    // ============================================================
    await resetClinicToFree();
    {
      const pw = await callFn('get-paywall-state', {}, token);
      const plans = pw.data?.plans ?? [];
      const ids = plans.map((p) => p.id);
      const hasNewPlans = ['standard', 'advanced', 'premium'].every((id) => ids.includes(id));
      const hasAnnual = plans
        .filter((p) => ['standard', 'advanced', 'premium'].includes(p.id))
        .every((p) => Number(p.preco_anual_mensal_cents) > 0);
      if (pw.data?.requires_paywall === true && hasNewPlans && hasAnnual && pw.data?.trial_used === false) {
        pass('2. Paywall FREE', `planos=[${ids.join(', ')}] com preço anual`);
      } else {
        fail('2. Paywall FREE', JSON.stringify({ requires: pw.data?.requires_paywall, ids, hasAnnual, trial_used: pw.data?.trial_used }));
      }
    }

    // ============================================================
    // 3. Checkout STANDARD mensal 1ª vez → trial 14d
    // ============================================================
    {
      const co = await callFn('create-stripe-checkout', { plan_id: 'standard', billing_cycle: 'monthly' }, token);
      if (co.status === 200 && co.data?.url && co.data?.trial_granted === true && co.data?.trial_days === 14 && co.data?.billing_cycle === 'monthly') {
        pass('3. Checkout STANDARD mensal (1ª vez)', `trial 14d, session ${co.data.session_id}`);
      } else {
        fail('3. Checkout STANDARD mensal (1ª vez)', JSON.stringify(co.body));
      }
    }

    // ============================================================
    // 12. 2ª tentativa de trial → cobra imediato (sem trial)
    // ============================================================
    {
      await db.query(`UPDATE clinics SET trial_used = true WHERE id = $1`, [TEST_CLINIC_ID]);
      const co = await callFn('create-stripe-checkout', { plan_id: 'standard', billing_cycle: 'monthly' }, token);
      if (co.status === 200 && co.data?.trial_granted === false && co.data?.trial_days === 0) {
        pass('12. 2ª tentativa sem trial', 'trial_granted=false');
      } else {
        fail('12. 2ª tentativa sem trial', JSON.stringify(co.body));
      }
      await db.query(`UPDATE clinics SET trial_used = false WHERE id = $1`, [TEST_CLINIC_ID]);
    }

    // ============================================================
    // 3b. Trial provisionado via webhook (trial_active + limites 10)
    // ============================================================
    let customerId = (await clinicRow()).stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: TEST_USER_EMAIL,
        metadata: { clinic_id: TEST_CLINIC_ID, qa: 'v2' },
      });
      customerId = customer.id;
      await db.query(`UPDATE clinics SET stripe_customer_id = $2 WHERE id = $1`, [TEST_CLINIC_ID, customerId]);
    }
    createdCustomers.add(customerId);

    try {
      await attachCardAsDefault(customerId);
      await createSubscription({
        customerId,
        priceId: prices.standard.stripe_price_id_test,
        planId: 'standard',
        cycle: 'monthly',
        trialDays: 14,
      });
      const row = await waitFor('trial_active via webhook', async () => {
        const r = await clinicRow();
        return r.status === 'trial_active' && r.plan === 'standard' ? r : null;
      });
      const settings = (
        await db.query(`SELECT max_patients_per_professional FROM clinic_settings WHERE clinic_id = $1`, [TEST_CLINIC_ID])
      ).rows[0];
      if (row.trial_used === true && Number(settings?.max_patients_per_professional) === 10 && row.trial_ends_at) {
        pass('3b. Trial provisionado via webhook', `trial_active até ${new Date(row.trial_ends_at).toLocaleDateString('pt-BR')}, limite 10 pacientes`);
      } else {
        fail('3b. Trial provisionado via webhook', JSON.stringify({ row, settings }));
      }
    } catch (e) {
      fail('3b. Trial provisionado via webhook', e.message);
    }

    // ============================================================
    // 4. Cancelar durante o trial → imediato, detach, FREE, audit
    // ============================================================
    try {
      const preview = await callFn('cancel-subscription', { action: 'preview' }, token);
      if (preview.data?.in_trial === true && preview.data?.cancels_immediately === true) {
        pass('4. Preview do cancelamento em trial', 'imediato, sem cobrança');
      } else {
        fail('4. Preview do cancelamento em trial', JSON.stringify(preview.body));
      }

      const confirm = await callFn('cancel-subscription', { action: 'confirm' }, token);
      const pmList = await stripe.paymentMethods.list({ customer: customerId, limit: 10 });
      const row = await clinicRow();
      const audit = (
        await db.query(
          `SELECT COUNT(*)::int AS n FROM audit_logs WHERE clinic_id = $1 AND action = 'billing.subscription.cancel' AND created_at > now() - interval '2 minutes'`,
          [TEST_CLINIC_ID],
        )
      ).rows[0];
      if (
        confirm.data?.downgraded_to_free === true &&
        confirm.data?.payment_methods_detached >= 1 &&
        pmList.data.length === 0 &&
        row.plan === 'free' &&
        row.status === 'canceled' &&
        row.payment_method_on_file === false &&
        audit.n >= 1
      ) {
        pass('4. Cancelar no trial', `cartões desanexados=${confirm.data.payment_methods_detached}, FREE, audit ok`);
      } else {
        fail('4. Cancelar no trial', JSON.stringify({ confirm: confirm.body, pmCount: pmList.data.length, row, audit }));
      }
    } catch (e) {
      fail('4. Cancelar no trial', e.message);
    }

    // ============================================================
    // 7. Upgrade STANDARD→PREMIUM (assinatura ativa)
    // ============================================================
    let activeSub = null;
    try {
      await attachCardAsDefault(customerId);
      activeSub = await createSubscription({
        customerId,
        priceId: prices.standard.stripe_price_id_test,
        planId: 'standard',
        cycle: 'monthly',
      });
      await waitFor('assinatura standard ativa', async () => {
        const r = await clinicRow();
        return r.status === 'active' && r.plan === 'standard' ? r : null;
      });

      const item = (await stripe.subscriptions.retrieve(activeSub.id)).items.data[0];
      await stripe.subscriptions.update(activeSub.id, {
        items: [{ id: item.id, price: prices.premium.stripe_price_id_test }],
        metadata: { clinic_id: TEST_CLINIC_ID, plan_id: 'premium', billing_cycle: 'monthly', qa: 'v2' },
        proration_behavior: 'create_prorations',
      });
      await waitFor('upgrade premium via webhook', async () => {
        const r = await clinicRow();
        return r.plan === 'premium' && r.status === 'active' ? r : null;
      });
      const settings = (
        await db.query(`SELECT max_patients_per_professional FROM clinic_settings WHERE clinic_id = $1`, [TEST_CLINIC_ID])
      ).rows[0];
      if (Number(settings?.max_patients_per_professional) === 30) {
        pass('7. Upgrade STANDARD→PREMIUM', 'proration + limite 30 pacientes');
      } else {
        fail('7. Upgrade STANDARD→PREMIUM', `settings=${JSON.stringify(settings)}`);
      }
    } catch (e) {
      fail('7. Upgrade STANDARD→PREMIUM', e.message);
    }

    // ============================================================
    // 9. Módulo adicional (+5 pacientes) na assinatura ativa
    // ============================================================
    try {
      const buy = await callFn('purchase-patient-quota-pack', { quantity: 1 }, token);
      const addonRow = (
        await db.query(
          `SELECT quantidade, status FROM clinic_addons WHERE clinic_id = $1 AND status = 'active'`,
          [TEST_CLINIC_ID],
        )
      ).rows[0];
      const bonus = (
        await db.query(`SELECT patient_quota_bonus FROM professionals WHERE clinic_id = $1 LIMIT 1`, [TEST_CLINIC_ID])
      ).rows[0];
      const subNow = await stripe.subscriptions.retrieve(activeSub.id);
      if (
        buy.status === 200 &&
        Number(buy.data?.patient_quota_bonus) === 5 &&
        addonRow?.quantidade === 1 &&
        Number(bonus?.patient_quota_bonus) === 5 &&
        subNow.items.data.length === 2
      ) {
        pass('9. Módulo adicional', '+5 pacientes, item na assinatura Stripe');
      } else {
        fail('9. Módulo adicional', JSON.stringify({ buy: buy.body, addonRow, bonus, items: subNow.items.data.length }));
      }
    } catch (e) {
      fail('9. Módulo adicional', e.message);
    }

    // ============================================================
    // 14. Cancelamento no Stripe → downgrade automático p/ FREE
    //     (equivale ao fim da inadimplência: subscription.deleted)
    // ============================================================
    try {
      const patientsBefore = (
        await db.query(`SELECT COUNT(*)::int AS n FROM patients WHERE clinic_id = $1 AND deleted_at IS NULL`, [TEST_CLINIC_ID])
      ).rows[0].n;
      await stripe.subscriptions.cancel(activeSub.id);
      const row = await waitFor('downgrade automático p/ FREE', async () => {
        const r = await clinicRow();
        return r.plan === 'free' && r.status === 'canceled' ? r : null;
      });
      const patientsAfter = (
        await db.query(`SELECT COUNT(*)::int AS n FROM patients WHERE clinic_id = $1 AND deleted_at IS NULL`, [TEST_CLINIC_ID])
      ).rows[0].n;
      const activeAddons = (
        await db.query(`SELECT COUNT(*)::int AS n FROM clinic_addons WHERE clinic_id = $1 AND status = 'active'`, [TEST_CLINIC_ID])
      ).rows[0].n;
      const bonus = (
        await db.query(`SELECT patient_quota_bonus FROM professionals WHERE clinic_id = $1 LIMIT 1`, [TEST_CLINIC_ID])
      ).rows[0];
      if (patientsBefore === patientsAfter && activeAddons === 0 && Number(bonus?.patient_quota_bonus) === 0 && !row.stripe_subscription_id) {
        pass('14. Downgrade automático p/ FREE', `dados preservados (${patientsAfter} pacientes), módulos cancelados`);
      } else {
        fail('14. Downgrade automático p/ FREE', JSON.stringify({ patientsBefore, patientsAfter, activeAddons, bonus }));
      }
    } catch (e) {
      fail('14. Downgrade automático p/ FREE', e.message);
    }

    // ============================================================
    // 8. Assinatura ANUAL (12x emulado) → commitment_ends_at
    // ============================================================
    try {
      await attachCardAsDefault(customerId);
      await createSubscription({
        customerId,
        priceId: prices.standard.stripe_price_id_test_anual,
        planId: 'standard',
        cycle: 'yearly',
      });
      const row = await waitFor('anual ativa via webhook', async () => {
        const r = await clinicRow();
        return r.status === 'active' && r.plan === 'standard' && r.billing_cycle === 'yearly' ? r : null;
      });
      const commitment = row.commitment_ends_at ? new Date(row.commitment_ends_at) : null;
      const expected = new Date();
      expected.setUTCFullYear(expected.getUTCFullYear() + 1);
      const deltaDays = commitment ? Math.abs(commitment.getTime() - expected.getTime()) / 86400000 : 999;
      if (commitment && deltaDays < 3) {
        pass('8. Assinatura anual (12x)', `1ª parcela R$ ${(prices.standard.preco_anual_mensal_cents / 100).toFixed(2)}, compromisso até ${commitment.toLocaleDateString('pt-BR')}`);
      } else {
        fail('8. Assinatura anual (12x)', JSON.stringify({ commitment: row.commitment_ends_at, deltaDays }));
      }
    } catch (e) {
      fail('8. Assinatura anual (12x)', e.message);
    }

    // ============================================================
    // 8b. Cancelar anual → quebra de fidelidade + invoice + detach
    // ============================================================
    try {
      const expectedFidelity = prices.standard.preco_mensal_cents - prices.standard.preco_anual_mensal_cents; // 1 mês usado
      const preview = await callFn('cancel-subscription', { action: 'preview' }, token);
      const previewOk =
        preview.data?.yearly_commitment_active === true &&
        preview.data?.requires_fidelity_acceptance === true &&
        Number(preview.data?.fidelity_adjustment_cents) === expectedFidelity;
      if (previewOk) {
        pass('8b. Preview quebra de fidelidade', `R$ ${(expectedFidelity / 100).toFixed(2)} (1 mês recalculado)`);
      } else {
        fail('8b. Preview quebra de fidelidade', JSON.stringify(preview.body));
      }

      const noAccept = await callFn('cancel-subscription', { action: 'confirm' }, token);
      if (noAccept.status === 400) {
        pass('8b. Confirm sem aceite é bloqueado', 'FIDELITY_ACCEPTANCE_REQUIRED');
      } else {
        fail('8b. Confirm sem aceite é bloqueado', `status ${noAccept.status}`);
      }

      const confirm = await callFn('cancel-subscription', { action: 'confirm', accept_fidelity_adjustment: true }, token);
      const pmList = await stripe.paymentMethods.list({ customer: customerId, limit: 10 });
      // aguarda o webhook subscription.updated (cancel_at_period_end) assentar sem
      // reverter payment_method_on_file
      const row = await waitFor('pm revogado estável pós-cancelamento', async () => {
        const r = await clinicRow();
        return r.payment_method_on_file === false ? r : null;
      }, 30000);
      if (
        confirm.data?.canceled === true &&
        confirm.data?.cancels_immediately === false &&
        confirm.data?.fidelity_invoice_paid === true &&
        pmList.data.length === 0 &&
        row.payment_method_on_file === false
      ) {
        pass('8b. Cancelamento anual confirmado', `invoice de fidelidade paga (${confirm.data.fidelity_invoice_id}), acesso até ${new Date(confirm.data.effective_at).toLocaleDateString('pt-BR')}, cartão removido`);
      } else {
        fail('8b. Cancelamento anual confirmado', JSON.stringify({ confirm: confirm.body, pmCount: pmList.data.length, row }));
      }
    } catch (e) {
      fail('8b. Cancelamento anual', e.message);
    }

    // encerra a assinatura anual de vez (limpeza) e aguarda downgrade
    try {
      const subId = (await clinicRow()).stripe_subscription_id;
      if (subId) {
        await stripe.subscriptions.cancel(subId);
        await waitFor('downgrade pós-anual', async () => {
          const r = await clinicRow();
          return r.plan === 'free' ? r : null;
        });
      }
    } catch { /* limpeza best-effort */ }

    // ============================================================
    // 10/10b. Cota de sessões (soft por paciente, hard total)
    // ============================================================
    try {
      await db.query(`UPDATE clinics SET subscription_plan = 'standard' WHERE id = $1`, [TEST_CLINIC_ID]);
      const prof = (
        await db.query(`SELECT id, user_id FROM professionals WHERE clinic_id = $1 AND deleted_at IS NULL LIMIT 1`, [TEST_CLINIC_ID])
      ).rows[0];
      const patient = (
        await db.query(
          `INSERT INTO patients (clinic_id, professional_id, name, birth_date, created_by, status, status_vinculo)
           VALUES ($1, $2, 'QA Cota Sessões', '2015-01-01', $3, 'active', 'ativo') RETURNING id`,
          [TEST_CLINIC_ID, prof.id, prof.user_id],
        )
      ).rows[0];
      qaPatientId = patient.id;

      for (let i = 0; i < 4; i += 1) {
        await db.query(
          `INSERT INTO therapist_schedule (clinic_id, professional_id, patient_id, title, scheduled_at, status)
           VALUES ($1, $2, $3, 'QA sessão', date_trunc('month', now()) + interval '1 day' + ($4 || ' hours')::interval, 'scheduled')`,
          [TEST_CLINIC_ID, prof.id, qaPatientId, String(8 + i)],
        );
      }

      const soft = (
        await db.query(`SELECT check_session_quota($1, $2) AS q`, [TEST_CLINIC_ID, qaPatientId])
      ).rows[0].q;
      if (soft.warn_patient === true && soft.blocked_total === false && soft.total_limit === 40 && soft.patient_used === 4) {
        pass('10. Cota de sessões soft', `4/4 do paciente (aviso), total ${soft.total_used}/40 liberado`);
      } else {
        fail('10. Cota de sessões soft', JSON.stringify(soft));
      }

      await db.query(`UPDATE clinics SET subscription_plan = 'free' WHERE id = $1`, [TEST_CLINIC_ID]);
      const hard = (
        await db.query(`SELECT check_session_quota($1, $2) AS q`, [TEST_CLINIC_ID, qaPatientId])
      ).rows[0].q;
      if (hard.blocked_total === true && hard.total_limit === 4) {
        pass('10b. Cota de sessões hard', `total ${hard.total_used}/${hard.total_limit} → bloqueio`);
      } else {
        fail('10b. Cota de sessões hard', JSON.stringify(hard));
      }
    } catch (e) {
      fail('10. Cota de sessões', e.message);
    } finally {
      if (qaPatientId) {
        await db.query(`DELETE FROM therapist_schedule WHERE patient_id = $1`, [qaPatientId]).catch(() => {});
        await db.query(`DELETE FROM patients WHERE id = $1`, [qaPatientId]).catch(() => {});
      }
    }

    // ============================================================
    // 11. Cota de IA (FREE = 20/mês): aviso 80%, bloqueio 100%
    // ============================================================
    try {
      await db.query(`UPDATE clinics SET subscription_plan = 'free' WHERE id = $1`, [TEST_CLINIC_ID]);
      await db.query(`DELETE FROM ai_usage_events WHERE clinic_id = $1 AND feature = 'qa-v2'`, [TEST_CLINIC_ID]);
      await db.query(
        `INSERT INTO ai_usage_events (clinic_id, feature) SELECT $1, 'qa-v2' FROM generate_series(1, 16)`,
        [TEST_CLINIC_ID],
      );
      const warn = (
        await db.query(`SELECT check_ai_interaction_quota($1) AS q`, [TEST_CLINIC_ID])
      ).rows[0].q;
      await db.query(
        `INSERT INTO ai_usage_events (clinic_id, feature) SELECT $1, 'qa-v2' FROM generate_series(1, 4)`,
        [TEST_CLINIC_ID],
      );
      const blocked = (
        await db.query(`SELECT check_ai_interaction_quota($1) AS q`, [TEST_CLINIC_ID])
      ).rows[0].q;
      if (warn.warn === true && warn.blocked === false && blocked.blocked === true && blocked.limit === 20) {
        pass('11. Cota de IA', `aviso em ${warn.used}/20, bloqueio em ${blocked.used}/20`);
      } else {
        fail('11. Cota de IA', JSON.stringify({ warn, blocked }));
      }
    } catch (e) {
      fail('11. Cota de IA', e.message);
    } finally {
      await db.query(`DELETE FROM ai_usage_events WHERE clinic_id = $1 AND feature = 'qa-v2'`, [TEST_CLINIC_ID]).catch(() => {});
    }

    // ============================================================
    // 13. Cron sync-stripe-subscriptions
    // ============================================================
    {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-stripe-subscriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Cron-Secret': CRON_SECRET },
        body: JSON.stringify({ source: 'qa-planos-v2' }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        pass('13. Cron sync-stripe-subscriptions', JSON.stringify(body.data ?? {}));
      } else {
        fail('13. Cron sync-stripe-subscriptions', JSON.stringify(body));
      }
    }
  } finally {
    // ---------------- Cleanup ----------------
    console.log('\n🧹 Limpeza…');
    for (const subId of createdSubscriptions) {
      try {
        const sub = await stripe.subscriptions.retrieve(subId);
        if (sub.status !== 'canceled') await stripe.subscriptions.cancel(subId);
      } catch { /* já cancelada */ }
    }
    for (const custId of createdCustomers) {
      try {
        const pms = await stripe.paymentMethods.list({ customer: custId, limit: 20 });
        for (const pm of pms.data) await stripe.paymentMethods.detach(pm.id).catch(() => {});
      } catch { /* ok */ }
    }
    if (qaClinicRegisteredId) {
      await db.query(`UPDATE clinics SET deleted_at = now() WHERE id = $1`, [qaClinicRegisteredId]).catch(() => {});
    }
    if (qaRegisteredUserId) {
      await admin.auth.admin.deleteUser(qaRegisteredUserId).catch(() => {});
    }

    await db.query(
      `UPDATE clinics SET subscription_plan = $2::subscription_plan, subscription_status = $3::subscription_status,
         payment_method_on_file = $4, billing_cycle = $5, trial_used = $6, trial_ends_at = $7,
         commitment_ends_at = $8, stripe_customer_id = $9, stripe_subscription_id = $10
       WHERE id = $1`,
      [
        TEST_CLINIC_ID,
        backup.subscription_plan,
        backup.subscription_status,
        backup.payment_method_on_file,
        backup.billing_cycle,
        backup.trial_used,
        backup.trial_ends_at,
        backup.commitment_ends_at,
        backup.stripe_customer_id,
        backup.stripe_subscription_id,
      ],
    ).catch((e) => console.error('restore falhou:', e.message));
    await db.query(`SELECT sync_clinic_settings_from_plano($1)`, [TEST_CLINIC_ID]).catch(() => {});
    await db.end();
    console.log('↩️  Clínica de teste restaurada.');
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${results.length - failed.length}/${results.length} cenários passaram`);
  if (failed.length) {
    console.log('Falhas:', failed.map((f) => f.name).join(' | '));
  }
  console.log('Cenários 5/6 (fim de trial cobra/falha) → roteiro manual com test clocks.');
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error('FATAL', err);
  process.exit(1);
});
