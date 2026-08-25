#!/usr/bin/env node
/**
 * Unithery — Setup do catálogo Stripe (planos de produção v2)
 *
 * Cria/atualiza produtos e prices na Stripe (test ou live) e grava os
 * price IDs de volta no banco (planos / plan_addons).
 *
 * Idempotente: reutiliza produtos via metadata e prices via lookup_key.
 * Se o valor de um price divergir do catálogo, cria um novo price e
 * transfere o lookup_key (o antigo é arquivado).
 *
 * Uso:
 *   node scripts/setup-stripe-catalog.mjs                 # test mode
 *   node scripts/setup-stripe-catalog.mjs --mode live --confirm-live
 *
 * Env: STRIPE_TEST_SECRET_KEY | STRIPE_LIVE_SECRET_KEY, DATABASE_URL
 * Ref: docs/plano-implementacao-planos-producao.md
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Stripe from 'stripe';
import pg from 'pg';

function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvFile(resolve('.env'));
loadEnvFile(resolve('.env.local'));

const args = process.argv.slice(2);
const mode = args.includes('--mode') ? args[args.indexOf('--mode') + 1] : 'test';

if (!['test', 'live'].includes(mode)) {
  console.error('Modo inválido. Use --mode test | live');
  process.exit(1);
}
if (mode === 'live' && !args.includes('--confirm-live')) {
  console.error('Modo LIVE exige a flag --confirm-live (cria produtos/prices reais).');
  process.exit(1);
}

function fromGcloudSecret(name) {
  try {
    return execFileSync(
      'gcloud',
      [
        'secrets',
        'versions',
        'access',
        'latest',
        `--secret=${name}`,
        '--project=plataforma-therapy-ai',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
  } catch {
    return null;
  }
}

function fromCloudRunEnv(varName) {
  try {
    const json = execFileSync(
      'gcloud',
      [
        'run',
        'services',
        'describe',
        'unithery-api-staging',
        '--region=us-central1',
        '--project=plataforma-therapy-ai',
        '--format=json',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const env = JSON.parse(json)?.spec?.template?.spec?.containers?.[0]?.env ?? [];
    const hit = env.find((e) => e.name === varName);
    if (hit?.value) return hit.value;
    const secretName =
      hit?.valueFrom?.secretKeyRef?.name ??
      hit?.valueSource?.secretKeyRef?.secret ??
      hit?.valueSource?.secretKeyRef?.name;
    if (secretName) return fromGcloudSecret(secretName);
    return null;
  } catch {
    return null;
  }
}

function resolveStripeSecret(billingMode) {
  const envName = billingMode === 'test' ? 'STRIPE_TEST_SECRET_KEY' : 'STRIPE_LIVE_SECRET_KEY';
  if (process.env[envName]) return process.env[envName];
  const candidates = [
    envName,
    envName.toLowerCase().replaceAll('_', '-'),
    billingMode === 'test' ? 'stripe-test-secret-key' : 'stripe-live-secret-key',
  ];
  for (const name of candidates) {
    const val = fromGcloudSecret(name);
    if (val) return val;
  }
  return fromCloudRunEnv(envName);
}

const secretKey = resolveStripeSecret(mode);
if (!secretKey) {
  console.error(`Chave STRIPE_${mode.toUpperCase()}_SECRET_KEY não encontrada no ambiente, Secret Manager ou Cloud Run.`);
  process.exit(1);
}

const stripe = new Stripe(secretKey);

async function connectDb() {
  try {
    const { connect } = await import('./cloudsql-connect.mjs');
    return await connect();
  } catch (error) {
    if (!process.env.DATABASE_URL) throw error;
    console.warn('Cloud SQL indisponível, usando DATABASE_URL do ambiente.');
    const client = new pg.Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    return client;
  }
}

// ------------------------------------------------------------------
// Catálogo canônico (espelho de planos / plan_addons no banco)
// Preços anuais = parcela mensal do 12x emulado (12% off), interval=month.
// ------------------------------------------------------------------

const PLANS = [
  {
    id: 'standard',
    productName: 'Unithery — Plano Standard',
    description: 'Até 10 pacientes ativos · Copiloto de IA · Diário familiar e portal',
    patientLimit: 10,
    monthlyCents: 23700,
    yearlyMonthlyCents: 20700,
  },
  {
    id: 'advanced',
    productName: 'Unithery — Plano Advanced',
    description: 'Até 20 pacientes ativos · Copiloto de IA · Diário familiar e portal',
    patientLimit: 20,
    monthlyCents: 42700,
    yearlyMonthlyCents: 37700,
  },
  {
    id: 'premium',
    productName: 'Unithery — Plano Premium',
    description: 'Até 30 pacientes ativos · Copiloto de IA · Diário familiar e portal',
    patientLimit: 30,
    monthlyCents: 65700,
    yearlyMonthlyCents: 57700,
  },
];

const ADDONS = [
  {
    id: 'modulo_sa',
    productName: 'Unithery — Módulo Adicional (+5 pacientes)',
    description: 'Para planos Standard e Advanced: +5 pacientes ativos',
    monthlyCents: 12943,
    yearlyMonthlyCents: 11390,
  },
  {
    id: 'modulo_p',
    productName: 'Unithery — Módulo Adicional Premium (+5 pacientes)',
    description: 'Para o plano Premium: +5 pacientes ativos',
    monthlyCents: 10632,
    yearlyMonthlyCents: 9356,
  },
];

// ------------------------------------------------------------------

async function findProductByMetadata(key, value) {
  const products = await stripe.products.list({ limit: 100, active: true });
  return products.data.find((p) => p.metadata?.[key] === value) ?? null;
}

async function ensureProduct({ metaKey, metaValue, name, description, extraMetadata = {} }) {
  const existing = await findProductByMetadata(metaKey, metaValue);
  if (existing) {
    if (existing.name !== name || existing.description !== description) {
      await stripe.products.update(existing.id, { name, description });
      console.log(`  ~ produto atualizado: ${existing.id} (${name})`);
    } else {
      console.log(`  = produto ok: ${existing.id} (${name})`);
    }
    return existing;
  }
  const created = await stripe.products.create({
    name,
    description,
    metadata: { [metaKey]: metaValue, source: 'unithery_catalog_v2', ...extraMetadata },
  });
  console.log(`  + produto criado: ${created.id} (${name})`);
  return created;
}

async function ensurePrice({ productId, lookupKey, unitAmount, billingCycle }) {
  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  const current = existing.data[0];

  if (current && current.unit_amount === unitAmount && current.product === productId && current.active) {
    console.log(`  = price ok: ${current.id} (${lookupKey} → R$ ${(unitAmount / 100).toFixed(2)}/mês)`);
    return current;
  }

  const created = await stripe.prices.create({
    product: productId,
    currency: 'brl',
    unit_amount: unitAmount,
    recurring: { interval: 'month' },
    lookup_key: lookupKey,
    transfer_lookup_key: true,
    metadata: { source: 'unithery_catalog_v2', billing_cycle: billingCycle },
  });
  if (current) {
    await stripe.prices.update(current.id, { active: false });
    console.log(`  ~ price substituído: ${current.id} → ${created.id} (${lookupKey} → R$ ${(unitAmount / 100).toFixed(2)}/mês)`);
  } else {
    console.log(`  + price criado: ${created.id} (${lookupKey} → R$ ${(unitAmount / 100).toFixed(2)}/mês)`);
  }
  return created;
}

async function main() {
  console.log(`\n=== Setup catálogo Stripe — modo ${mode.toUpperCase()} ===\n`);

  const dbUpdates = [];

  for (const plan of PLANS) {
    console.log(`Plano ${plan.id}:`);
    const product = await ensureProduct({
      metaKey: 'plan_id',
      metaValue: plan.id,
      name: plan.productName,
      description: plan.description,
      extraMetadata: { patient_limit: String(plan.patientLimit) },
    });
    const monthly = await ensurePrice({
      productId: product.id,
      lookupKey: `plano_${plan.id}_mensal`,
      unitAmount: plan.monthlyCents,
      billingCycle: 'monthly',
    });
    const yearly = await ensurePrice({
      productId: product.id,
      lookupKey: `plano_${plan.id}_anual`,
      unitAmount: plan.yearlyMonthlyCents,
      billingCycle: 'yearly_12x',
    });
    dbUpdates.push({
      table: 'planos',
      id: plan.id,
      monthlyPriceId: monthly.id,
      yearlyPriceId: yearly.id,
    });
  }

  for (const addon of ADDONS) {
    console.log(`Módulo ${addon.id}:`);
    const product = await ensureProduct({
      metaKey: 'addon_id',
      metaValue: addon.id,
      name: addon.productName,
      description: addon.description,
      extraMetadata: { pacientes_bonus: '5' },
    });
    const monthly = await ensurePrice({
      productId: product.id,
      lookupKey: `addon_${addon.id}_mensal`,
      unitAmount: addon.monthlyCents,
      billingCycle: 'monthly',
    });
    const yearly = await ensurePrice({
      productId: product.id,
      lookupKey: `addon_${addon.id}_anual`,
      unitAmount: addon.yearlyMonthlyCents,
      billingCycle: 'yearly_12x',
    });
    dbUpdates.push({
      table: 'plan_addons',
      id: addon.id,
      monthlyPriceId: monthly.id,
      yearlyPriceId: yearly.id,
    });
  }

  console.log('\nGravando price IDs no banco...');
  const client = await connectDb();
  try {
    for (const u of dbUpdates) {
      if (u.table === 'planos') {
        const col = mode === 'test' ? 'stripe_price_id_test' : 'stripe_price_id_live';
        const plan = PLANS.find((p) => p.id === u.id);
        await client.query(
          `UPDATE planos
              SET ${col} = $1,
                  ${col}_anual = $2,
                  preco_mensal_cents = COALESCE($4, preco_mensal_cents),
                  preco_anual_mensal_cents = COALESCE($5, preco_anual_mensal_cents),
                  updated_at = now()
            WHERE id = $3`,
          [u.monthlyPriceId, u.yearlyPriceId, u.id, plan?.monthlyCents ?? null, plan?.yearlyMonthlyCents ?? null]
        );
      } else {
        const prefix = mode === 'test' ? 'stripe_price_id_test' : 'stripe_price_id_live';
        await client.query(
          `UPDATE plan_addons SET ${prefix}_mensal = $1, ${prefix}_anual = $2, updated_at = now() WHERE id = $3`,
          [u.monthlyPriceId, u.yearlyPriceId, u.id]
        );
      }
      console.log(`  ✓ ${u.table}.${u.id}: mensal=${u.monthlyPriceId} anual=${u.yearlyPriceId}`);
    }
  } finally {
    await client.end();
  }

  console.log(`\n✅ Catálogo ${mode.toUpperCase()} sincronizado.\n`);
}

main().catch((err) => {
  console.error('❌ Falha:', err.message);
  process.exit(1);
});
