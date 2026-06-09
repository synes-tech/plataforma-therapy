import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://postgres:123bd-therapy.ai123@db.yfzhjdfvaosezyjvbyid.supabase.co:5432/postgres';

async function run() {
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const res = await client.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename;
  `);

  console.log('📋 Tables in public schema:\n');
  res.rows.forEach(r => console.log(`  ✅ ${r.tablename}`));
  console.log(`\n  Total: ${res.rows.length} tables`);

  // Check RLS status
  const rlsRes = await client.query(`
    SELECT c.relname, c.relrowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname;
  `);

  console.log('\n🔒 RLS Status:\n');
  rlsRes.rows.forEach(r => {
    const icon = r.relrowsecurity ? '🔒' : '⚠️';
    console.log(`  ${icon} ${r.relname} — RLS ${r.relrowsecurity ? 'ON' : 'OFF'}`);
  });

  await client.end();
}
run();
