/**
 * Validação T-01 — dois dependentes com mesmo cpf_responsavel (iniciativa 2.7)
 * Uso: node scripts/verify-dependent-identity.mjs
 */
import pg from 'pg';

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://postgres:123bd-therapy.ai123@db.yfzhjdfvaosezyjvbyid.supabase.co:5432/postgres';

async function run() {
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const checks = [];

  const cols = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'patients'
      AND column_name IN ('cpf_paciente', 'cpf_responsavel', 'nome_responsavel', 'cpf')
  `);
  const names = cols.rows.map((r) => r.column_name);
  checks.push(['colunas cpf_paciente/cpf_responsavel/nome_responsavel', names.includes('cpf_paciente') && names.includes('cpf_responsavel') && !names.includes('cpf')]);

  const unique = await client.query(`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'patients' AND indexname = 'idx_patients_professional_cpf_unique'
  `);
  checks.push(['sem unique profissional+cpf', unique.rows.length === 0]);

  const idxPaciente = await client.query(`
    SELECT indexname FROM pg_indexes WHERE indexname = 'idx_patients_cpf_paciente_search'
  `);
  const idxResp = await client.query(`
    SELECT indexname FROM pg_indexes WHERE indexname = 'idx_patients_cpf_responsavel_search'
  `);
  checks.push(['índices de busca CPF', idxPaciente.rows.length === 1 && idxResp.rows.length === 1]);

  console.log('\n═══ Verificação Iniciativa 2.7 (DB) ═══');
  let ok = true;
  for (const [label, pass] of checks) {
    console.log(`${pass ? '✅' : '❌'} ${label}`);
    if (!pass) ok = false;
  }

  await client.end();
  process.exit(ok ? 0 : 1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
