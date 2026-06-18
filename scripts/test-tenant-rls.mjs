/**
 * QA — matriz de isolamento multi-tenant (RLS helpers + policies)
 * Uso: node scripts/test-tenant-rls.mjs
 */
import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  try {
    const raw = readFileSync(resolve(__dirname, '../.env'), 'utf8');
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i === -1) continue;
      const key = t.slice(0, i);
      const val = t.slice(i + 1).replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* optional */
  }
}

loadEnv();

const dbUrl =
  process.env.DATABASE_URL ??
  `postgresql://postgres.${process.env.SUPABASE_PROJECT_REF ?? 'yfzhjdfvaosezyjvbyid'}:${process.env.SUPABASE_SERVICE_ROLE_KEY}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`;

function check(label, ok, detail = '') {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  return ok;
}

async function main() {
  console.log('\n=== QA: Multi-tenant RLS ===\n');
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const fn = await client.query(`SELECT proname FROM pg_proc WHERE proname = 'user_is_clinic_admin_for_patient'`);
  check('Função user_is_clinic_admin_for_patient', fn.rows.length === 1);

  const policies = await client.query(`
    SELECT tablename, policyname FROM pg_policies
    WHERE policyname LIKE '%clinic_admin%'
    ORDER BY tablename
  `);
  check('Policies clinic_admin', policies.rows.length >= 5, `${policies.rows.length} encontradas`);

  const subs = await client.query(`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'clinic_subscriptions'
  `);
  check('Tabela clinic_subscriptions', subs.rows.length === 1);

  const accountType = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'clinics' AND column_name = 'account_type'
  `);
  check('Coluna clinics.account_type', accountType.rows.length === 1);

  const soloCount = await client.query(`SELECT count(*)::int AS n FROM clinics WHERE account_type = 'solo'`);
  const corpCount = await client.query(`SELECT count(*)::int AS n FROM clinics WHERE account_type = 'corporate'`);
  console.log(`\n  ℹ Clínicas solo: ${soloCount.rows[0].n} | corporativas: ${corpCount.rows[0].n}`);

  console.log('\n=== Concluído (validação estrutural) ===\n');
  console.log('  Testes manuais obrigatórios:');
  console.log('  - Autônomo A não vê pacientes do Autônomo B (clinic_id diferente)');
  console.log('  - clinic_admin A vê pacientes dos profissionais da clínica A');
  console.log('  - clinic_admin A NÃO vê pacientes da clínica B');
  console.log('  - professional X não vê pacientes do professional Y (mesma clínica)\n');

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
