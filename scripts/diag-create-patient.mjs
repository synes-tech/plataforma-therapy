import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB = process.env.DATABASE_URL;

async function testUser(email, password) {
  const cli = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await cli.auth.signInWithPassword({ email, password });
  if (error) return { email, login: `FAIL ${error.message}` };

  const token = data.session.access_token;
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  const role = payload.app_metadata?.role ?? payload.role;

  const res = await fetch(`${URL}/functions/v1/create-patient`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: ANON },
    body: JSON.stringify({
      name: 'Teste Diag ' + Date.now(),
      birth_date: '2018-05-10',
      diagnoses: ['TEA'],
    }),
  });
  const json = await res.json();
  return {
    email,
    login: 'OK',
    jwt_role_top: payload.role,
    jwt_role_app: payload.app_metadata?.role,
    create_status: res.status,
    create_code: json.error?.code,
    create_msg: json.error?.message ?? json.data?.message,
  };
}

const c = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();
const { rows } = await c.query(`
  SELECT u.email, u.raw_app_meta_data->>'role' role, prof.id prof_id
  FROM auth.users u
  LEFT JOIN professionals prof ON prof.user_id=u.id AND prof.deleted_at IS NULL
  WHERE u.raw_app_meta_data->>'role' IN ('professional','clinic_admin')
  ORDER BY u.email LIMIT 8`);

console.log('=== DB: role vs professional record ===');
rows.forEach((r) => console.log(`${r.email} | role=${r.role} | prof=${r.prof_id ?? 'NULL'}`));

console.log('\n=== create-patient API (precisa senha conhecida) ===');
for (const pw of ['SmokeVertex123!', 'Therapy123!', '123456']) {
  for (const email of ['livia@clinica.com', 'pjoao4446@gmail.com']) {
    const r = await testUser(email, pw);
    if (r.login === 'OK') {
      console.log(JSON.stringify(r, null, 0));
    }
  }
}
await c.end();
