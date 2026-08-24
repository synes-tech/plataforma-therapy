#!/usr/bin/env node
/**
 * Catálogo B2C — Ivy, Acompanhante de Apoio.
 *
 * Cria o produto + preço mensal (R$ 49,90) com lookup_key `thery_apoio_mensal`.
 * Não grava em `planos` (catálogo B2B). Os IDs vão para env do Cloud Run:
 *   STRIPE_TEST_PRICE_THERY_APOIO / STRIPE_LIVE_PRICE_THERY_APOIO
 *
 *   node scripts/setup-stripe-b2c.mjs
 *   node scripts/setup-stripe-b2c.mjs --mode live --confirm-live
 */
import Stripe from 'stripe';

const args = process.argv.slice(2);
const mode = args.includes('--mode') ? args[args.indexOf('--mode') + 1] : 'test';

if (!['test', 'live'].includes(mode)) {
  console.error('Modo inválido. Use --mode test | live');
  process.exit(1);
}
if (mode === 'live' && !args.includes('--confirm-live')) {
  console.error('Modo LIVE exige --confirm-live.');
  process.exit(1);
}

const secretKey =
  mode === 'test' ? process.env.STRIPE_TEST_SECRET_KEY : process.env.STRIPE_LIVE_SECRET_KEY;
if (!secretKey) {
  console.error(`Chave STRIPE_${mode.toUpperCase()}_SECRET_KEY não encontrada.`);
  process.exit(1);
}

const stripe = new Stripe(secretKey);
const LOOKUP = 'thery_apoio_mensal';
const AMOUNT = 4990;

async function findProduct() {
  const products = await stripe.products.list({ limit: 100, active: true });
  return products.data.find((p) => p.metadata?.plan_code === LOOKUP || p.metadata?.account_type === 'patient') ?? null;
}

async function main() {
  console.log(`\n=== Catálogo B2C Ivy — modo ${mode.toUpperCase()} ===\n`);

  let product = await findProduct();
  if (product) {
    await stripe.products.update(product.id, {
      name: 'Ivy — Acompanhante de Apoio',
      description: 'Chat de apoio 24/7 para o paciente. 7 dias grátis com cartão. R$ 49,90/mês.',
      metadata: { plan_code: LOOKUP, account_type: 'patient', source: 'unithery_b2c' },
    });
    console.log(`  = produto ok: ${product.id}`);
  } else {
    product = await stripe.products.create({
      name: 'Ivy — Acompanhante de Apoio',
      description: 'Chat de apoio 24/7 para o paciente. 7 dias grátis com cartão. R$ 49,90/mês.',
      metadata: { plan_code: LOOKUP, account_type: 'patient', source: 'unithery_b2c' },
    });
    console.log(`  + produto criado: ${product.id}`);
  }

  const existing = await stripe.prices.list({ lookup_keys: [LOOKUP], limit: 1 });
  let price = existing.data[0];
  if (price && price.unit_amount === AMOUNT && price.active && price.product === product.id) {
    console.log(`  = price ok: ${price.id}`);
  } else {
    price = await stripe.prices.create({
      product: product.id,
      currency: 'brl',
      unit_amount: AMOUNT,
      recurring: { interval: 'month' },
      lookup_key: LOOKUP,
      transfer_lookup_key: true,
      metadata: { account_type: 'patient', plan_code: LOOKUP, source: 'unithery_b2c' },
    });
    if (existing.data[0]) {
      await stripe.prices.update(existing.data[0].id, { active: false });
    }
    console.log(`  + price: ${price.id}`);
  }

  const prefix = mode === 'live' ? 'STRIPE_LIVE' : 'STRIPE_TEST';
  console.log(`\nEnv para o Cloud Run:\n  ${prefix}_PRODUCT_THERY_APOIO=${product.id}\n  ${prefix}_PRICE_THERY_APOIO=${price.id}\n`);
}

main().catch((err) => {
  console.error('Falha:', err.message);
  process.exit(1);
});
