/**
 * E2E — Iniciativa 2.7 Identidade de Dependentes
 * Valida schema DB, criação via API (dependente + CPF próprio) e verify multi-match.
 *
 * Uso: node --env-file=.env scripts/e2e-dependent-identity.mjs
 * (Node 20+) ou: export $(grep -v '^#' .env | xargs) && node scripts/e2e-dependent-identity.mjs
 */
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB =
  process.env.DATABASE_URL ||
  'postgresql://postgres:123bd-therapy.ai123@db.yfzhjdfvaosezyjvbyid.supabase.co:5432/postgres';

const RESP_CPF = '11144477735';
const OWN_CPF = '52998224725';
const TS = Date.now();
const MARKER = `E2E-2.7-${TS}`;

let passed = 0;
let failed = 0;

function check(label, ok, detail = '') {
  if (ok) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function callFn(fn, token, body) {
  const res = await fetch(`${URL}/functions/v1/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: ANON,
    },
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function main() {
  if (!URL || !ANON || !SERVICE) {
    console.error('Defina SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY no .env');
    process.exit(1);
  }

  const db = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
  await db.connect();

  console.log('\n═══ 1. Schema do banco ═══');
  const cols = await db.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'patients'
      AND column_name IN ('cpf_paciente','cpf_responsavel','nome_responsavel','cpf')`);
  const names = cols.rows.map((r) => r.column_name);
  check('cpf_paciente existe', names.includes('cpf_paciente'));
  check('cpf_responsavel existe', names.includes('cpf_responsavel'));
  check('nome_responsavel existe', names.includes('nome_responsavel'));
  check('coluna legada cpf removida', !names.includes('cpf'));

  const uniqueIdx = await db.query(
    `SELECT 1 FROM pg_indexes WHERE indexname = 'idx_patients_professional_cpf_unique'`,
  );
  check('sem unique (professional_id, cpf)', uniqueIdx.rows.length === 0);

  console.log('\n═══ 2. Autenticação profissional ═══');
  const profRes = await db.query(`
    SELECT prof.id AS prof_id, prof.clinic_id, prof.user_id, u.email
    FROM professionals prof
    JOIN auth.users u ON u.id = prof.user_id
    WHERE prof.deleted_at IS NULL
      AND (u.raw_app_meta_data->>'role') = 'professional'
    ORDER BY u.email
    LIMIT 1`);
  if (profRes.rows.length === 0) {
    console.error('Nenhum profissional encontrado no banco.');
    await db.end();
    process.exit(1);
  }
  const { prof_id, clinic_id, user_id, email } = profRes.rows[0];
  console.log(`  Profissional: ${email} (${prof_id})`);

  const admin = createClient(URL, SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const pw = `E2eTest-${TS}!`;
  await admin.auth.admin.updateUserById(user_id, { password: pw });

  const cli = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: signIn, error: signErr } = await cli.auth.signInWithPassword({ email, password: pw });
  check('login profissional', !signErr && !!signIn?.session);
  if (signErr || !signIn?.session) {
    await db.end();
    process.exit(1);
  }
  const token = signIn.session.access_token;

  const createdIds = [];

  console.log('\n═══ 3. Criar dependente 1 (sem CPF paciente) ═══');
  const dep1 = await callFn('create-patient', token, {
    possui_cpf_proprio: false,
    cpf_responsavel: RESP_CPF,
    nome_responsavel: `Responsável ${MARKER}`,
    name: `${MARKER} Irmão A`,
    birth_date: '2016-03-15',
    diagnoses: ['TEA'],
  });
  const dep1Id = dep1.json?.data?.patient_id;
  check(
    'create-patient dependente 1 → 201',
    dep1.status === 201 && !!dep1Id,
    `status=${dep1.status} ${dep1.json?.error?.message ?? ''}`,
  );
  if (dep1Id) createdIds.push(dep1Id);

  console.log('\n═══ 4. Criar dependente 2 (mesmo CPF responsável) ═══');
  const dep2 = await callFn('create-patient', token, {
    possui_cpf_proprio: false,
    cpf_responsavel: RESP_CPF,
    nome_responsavel: `Responsável ${MARKER}`,
    name: `${MARKER} Irmão B`,
    birth_date: '2018-07-20',
    diagnoses: ['TDAH'],
  });
  const dep2Id = dep2.json?.data?.patient_id;
  check(
    'create-patient dependente 2 (irmão) → 201',
    dep2.status === 201 && !!dep2Id,
    `status=${dep2.status} ${dep2.json?.error?.message ?? ''}`,
  );
  if (dep2Id) createdIds.push(dep2Id);

  if (dep1Id && dep2Id) {
    const rowCheck = await db.query(
      `SELECT id, cpf_paciente, cpf_responsavel, nome_responsavel
       FROM patients WHERE id = ANY($1::uuid[])`,
      [[dep1Id, dep2Id]],
    );
    const rows = rowCheck.rows;
    check(
      'DB: ambos com cpf_paciente NULL',
      rows.every((r) => r.cpf_paciente === null),
    );
    check(
      'DB: mesmo cpf_responsavel',
      rows.every((r) => r.cpf_responsavel === RESP_CPF),
    );
    check(
      'DB: nome_responsavel preenchido',
      rows.every((r) => r.nome_responsavel?.includes(MARKER)),
    );
  }

  console.log('\n═══ 5. verify-patient-cpf → multi-match ═══');
  const verify = await callFn('verify-patient-cpf', token, { cpf: RESP_CPF });
  const matches = verify.json?.data?.matches ?? [];
  const ourMatches = matches.filter((m) =>
    [dep1Id, dep2Id].includes(m.patient_id),
  );
  check(
    'verify retorna exists=true',
    verify.json?.data?.exists === true,
    JSON.stringify(verify.json?.error ?? ''),
  );
  check(
    'verify inclui os 2 irmãos criados',
    ourMatches.length >= 2,
    `matches=${matches.length} nossos=${ourMatches.length}`,
  );
  check(
    'match_field cpf_responsavel',
    ourMatches.every((m) => m.match_field === 'cpf_responsavel'),
  );

  console.log('\n═══ 6. Criar paciente com CPF próprio ═══');
  const own = await callFn('create-patient', token, {
    possui_cpf_proprio: true,
    cpf_paciente: OWN_CPF,
    name: `${MARKER} Com CPF`,
    birth_date: '2015-01-10',
    diagnoses: ['TEA'],
  });
  const ownId = own.json?.data?.patient_id;
  check(
    'create-patient CPF próprio → 201',
    own.status === 201 && !!ownId,
    `status=${own.status} ${own.json?.error?.message ?? ''}`,
  );
  if (ownId) createdIds.push(ownId);

  if (ownId) {
    const ownRow = await db.query(
      `SELECT cpf_paciente, cpf_responsavel FROM patients WHERE id = $1`,
      [ownId],
    );
    check('DB: cpf_paciente preenchido', ownRow.rows[0]?.cpf_paciente === OWN_CPF);
    check('DB: cpf_responsavel NULL', ownRow.rows[0]?.cpf_responsavel === null);
  }

  console.log('\n═══ 7. list-patients busca por CPF responsável ═══');
  const list = await callFn('list-patients', token, { q: RESP_CPF });
  const listItems = list.json?.data ?? [];
  const listed = listItems.filter((p) => [dep1Id, dep2Id].includes(p.id));
  check(
    'list-patients encontra irmãos pelo CPF do responsável',
    listed.length >= 2,
    `total=${listItems.length} nossos=${listed.length}`,
  );

  console.log('\n═══ 8. Limpeza (soft delete) ═══');
  if (createdIds.length > 0) {
    await db.query(
      `UPDATE patients SET deleted_at = now(), status_vinculo = 'desvinculado'
       WHERE id = ANY($1::uuid[])`,
      [createdIds],
    );
    check(`limpeza de ${createdIds.length} pacientes de teste`, true);
  }

  await db.end();

  console.log('\n═══ Resultado ═══');
  console.log(`Passou: ${passed} | Falhou: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
