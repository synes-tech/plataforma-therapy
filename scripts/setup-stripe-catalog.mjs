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

import Stripe from 'stripe';
import pg from 'pg';

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

const secretKey =
  mode === 'test' ? process.env.STRIPE_TEST_SECRET_KEY : process.env.STRIPE_LIVE_SECRET_KEY;
if (!secretKey) {
  console.error(`Chave STRIPE_${mode.toUpperCase()}_SECRET_KEY não encontrada no ambiente.`);
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL não encontrada no ambiente.');
  process.exit(1);
}

const stripe = new Stripe(secretKey);

// ------------------------------------------------------------------
// Catálogo canônico (espelho de planos / plan_addons no banco)
// Preços anuais = parcela mensal do 12x emulado (12% off), interval=month.
// ------------------------------------------------------------------

const PLANS = [
  {
    id: 'standard',
    productName: 'Unithery — Plano Standard',
    description: 'Até 10 pacientes ativos · 40 sessões/mês · 750 interações de IA/mês',
    patientLimit: 10,
    monthlyCents: 23120,
    yearlyMonthlyCents: 20346,
  },
  {
    id: 'advanced',
    productName: 'Unithery — Plano Advanced',
    description: 'Até 20 pacientes ativos · 80 sessões/mês · 1.500 interações de IA/mês',
    patientLimit: 20,
    monthlyCents: 46240,
    yearlyMonthlyCents: 40691,
  },
  {
    id: 'premium',
    productName: 'Unithery — Plano Premium',
    description: 'Até 30 pacientes ativos · 120 sessões/mês · 2.250 interações de IA/mês',
    patientLimit: 30,
    monthlyCents: 69360,
    yearlyMonthlyCents: 61037,
  },
];

const ADDONS = [
  {
    id: 'modulo_sa',
    productName: 'Unithery — Módulo Adicional (+5 pacientes)',
    description: 'Para planos Standard e Advanced: +5 pacientes, +20 sessões, +375 interações de IA/mês',
    monthlyCents: 12943,
    yearlyMonthlyCents: 11390,
  },
  {
    id: 'modulo_p',
    productName: 'Unithery — Módulo Adicional Premium (+5 pacientes)',
    description: 'Para o plano Premium: +5 pacientes, +20 sessões, +375 interações de IA/mês',
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
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    for (const u of dbUpdates) {
      if (u.table === 'planos') {
        const col = mode === 'test' ? 'stripe_price_id_test' : 'stripe_price_id_live';
        await client.query(
          `UPDATE planos SET ${col} = $1, ${col}_anual = $2, updated_at = now() WHERE id = $3`,
          [u.monthlyPriceId, u.yearlyPriceId, u.id]
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
