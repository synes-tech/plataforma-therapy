/**
 * QA — simula família inativa no diário e valida RPC de lembretes.
 *
 * Uso:
 *   node scripts/test-diary-reminders.mjs
 *
 * Requer: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY no .env (ou ambiente)
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
    /* .env opcional */
  }
}

loadEnv();

const url = process.env.SUPABASE_URL?.replace('https://', 'postgresql://postgres:') ?? process.env.DATABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Supabase pooler URL pattern — use direct DB if DATABASE_URL set
const dbUrl =
  process.env.DATABASE_URL ??
  `postgresql://postgres.${process.env.SUPABASE_PROJECT_REF ?? 'yfzhjdfvaosezyjvbyid'}:${serviceKey}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`;

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

function check(label, ok, detail = '') {
  const icon = ok ? '✓' : '✗';
  console.log(`  ${icon} ${label}${detail ? ` — ${detail}` : ''}`);
  return ok;
}

async function main() {
  console.log('\n=== QA: Lembretes push do diário ===\n');

  await client.connect();

  // 1. RPC existe
  const fn = await client.query(`
    SELECT proname FROM pg_proc
    WHERE proname = 'get_families_needing_diary_reminder'
  `);
  check('RPC get_families_needing_diary_reminder', fn.rows.length === 1);

  // 2. Tabelas
  for (const table of ['push_subscriptions', 'push_reminder_log']) {
    const t = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
      [table],
    );
    check(`Tabela ${table}`, t.rows.length === 1);
  }

  // 3. Simular família inativa: paciente com link familiar sem diário recente
  const link = await client.query(`
    SELECT pfl.user_id, pfl.patient_id, p.name
    FROM patient_family_links pfl
    JOIN patients p ON p.id = pfl.patient_id
    WHERE pfl.user_id IS NOT NULL
    LIMIT 1
  `);

  if (link.rows.length === 0) {
    console.log('  ⚠ Sem patient_family_links — pulando simulação de inatividade');
  } else {
    const { user_id, patient_id, name } = link.rows[0];

    // Soft-delete diários recentes do paciente (rollback depois)
    await client.query('BEGIN');
    try {
      await client.query(
        `UPDATE diary_entries SET deleted_at = now()
         WHERE patient_id = $1 AND deleted_at IS NULL
         AND entry_date >= CURRENT_DATE - 3`,
        [patient_id],
      );

      // Inserir subscription fake para o teste
      const endpoint = `https://qa.test/push/${user_id}`;
      await client.query(
        `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth_key)
         VALUES ($1, $2, 'qa-p256dh', 'qa-auth')
         ON CONFLICT (user_id, endpoint) DO UPDATE SET updated_at = now()`,
        [user_id, endpoint],
      );

      const rpc = await client.query(
        `SELECT * FROM get_families_needing_diary_reminder(2)
         WHERE user_id = $1 AND patient_id = $2`,
        [user_id, patient_id],
      );

      check(
        'Família inativa aparece na RPC',
        rpc.rows.length >= 1,
        rpc.rows[0] ? `${name} (last: ${rpc.rows[0].last_entry_date ?? 'nunca'})` : 'vazio',
      );

      await client.query('ROLLBACK');
      check('Rollback da simulação', true);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  }

  // 4. RLS push_subscriptions (policy count)
  const policies = await client.query(`
    SELECT policyname FROM pg_policies
    WHERE tablename = 'push_subscriptions' AND schemaname = 'public'
  `);
  check('RLS policies em push_subscriptions', policies.rows.length >= 4, `${policies.rows.length} policies`);

  console.log('\n=== Concluído ===\n');
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
