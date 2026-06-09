import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB = process.env.DATABASE_URL;

const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });

async function call(fn, token, body) {
  const res = await fetch(`${URL}/functions/v1/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: ANON },
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function tokenFor(email, password) {
  const c = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signIn ${email}: ${error.message}`);
  return data.session.access_token;
}

const c = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
const cleanup = [];
let ok = 0, fail = 0;
const check = (name, cond, extra = '') => { if (cond) { ok++; console.log(`  PASS ${name}`); } else { fail++; console.log(`  FAIL ${name} ${extra}`); } };

try {
  await c.connect();

  // Pick a professional + their patient
  const { rows: pats } = await c.query(`
    SELECT pat.id patient_id, pat.clinic_id, prof.id professional_id, prof.user_id prof_user
    FROM patients pat JOIN professionals prof ON pat.professional_id = prof.id
    WHERE pat.deleted_at IS NULL AND prof.deleted_at IS NULL LIMIT 1`);
  if (!pats.length) throw new Error('no patient/professional found');
  const { patient_id, clinic_id, professional_id, prof_user } = pats[0];
  console.log('Using patient', patient_id, 'clinic', clinic_id);

  // A second professional+patient (for IDOR / cross-tenant)
  const { rows: others } = await c.query(`
    SELECT pat.id patient_id FROM patients pat
    WHERE pat.deleted_at IS NULL AND pat.id <> $1 LIMIT 1`, [patient_id]);
  const otherPatientId = others[0]?.patient_id ?? null;

  // Create invite
  const code = 'SMK' + Math.random().toString(36).slice(2, 7).toUpperCase();
  const inv = await c.query(`
    INSERT INTO invites (clinic_id, patient_id, professional_id, code, status, relationship, max_uses, expires_at, created_by)
    VALUES ($1,$2,$3,$4,'pending','mother', 1, now() + interval '1 day', $5) RETURNING id`,
    [clinic_id, patient_id, professional_id, code, prof_user]);
  cleanup.push(['invites', inv.rows[0].id]);
  console.log('Invite code:', code);

  // Expired invite
  const codeExp = 'EXP' + Math.random().toString(36).slice(2, 7).toUpperCase();
  const invExp = await c.query(`
    INSERT INTO invites (clinic_id, patient_id, professional_id, code, status, relationship, max_uses, expires_at, created_by)
    VALUES ($1,$2,$3,$4,'pending','father', 1, now() - interval '1 hour', $5) RETURNING id`,
    [clinic_id, patient_id, professional_id, codeExp, prof_user]);
  cleanup.push(['invites', invExp.rows[0].id]);

  // Create two family auth users
  const pw = 'Smoke123!';
  const famEmail = `smoke.fam.${Date.now()}@example.com`;
  const fam2Email = `smoke.fam2.${Date.now()}@example.com`;
  const { data: fam } = await admin.auth.admin.createUser({ email: famEmail, password: pw, email_confirm: true });
  const { data: fam2 } = await admin.auth.admin.createUser({ email: fam2Email, password: pw, email_confirm: true });
  cleanup.push(['auth_user', fam.user.id]);
  cleanup.push(['auth_user', fam2.user.id]);

  const famTok = await tokenFor(famEmail, pw);

  // 1. Expired invite is rejected
  const rExp = await call('link-family-account', famTok, { invite_code: codeExp, name: 'Pai Teste' });
  check('expired invite rejected (410)', rExp.status === 410, JSON.stringify(rExp.json));

  // 2. Valid link
  const rLink = await call('link-family-account', famTok, { invite_code: code, name: 'Mae Teste' });
  check('valid link (200)', rLink.status === 200, JSON.stringify(rLink.json));
  check('link returns patient_id', rLink.json?.data?.patient_id === patient_id);

  // 3. user_id recorded in patient_family_links
  const pfl = await c.query('SELECT user_id FROM patient_family_links WHERE patient_id=$1 AND user_id=$2', [patient_id, fam.user.id]);
  check('pfl.user_id recorded', pfl.rowCount === 1);

  // 4. burnt invite (reuse) -> 409
  const famTok2refresh = await tokenFor(famEmail, pw);
  const rReuse = await call('link-family-account', famTok2refresh, { invite_code: code, name: 'Mae Teste' });
  check('burnt invite rejected (4xx)', rReuse.status >= 400, JSON.stringify(rReuse.json));

  // 5. professional creates an agreement
  let profTok = null;
  try {
    // attempt to use a known professional password if exists; else insert agreement directly
    profTok = null;
  } catch { /* ignore */ }
  const ag = await c.query(`
    INSERT INTO agreements (patient_id, clinic_id, professional_id, title, description, created_by)
    VALUES ($1,$2,$3,'Praticar respiração 5 min','Antes de dormir',$4) RETURNING id`,
    [patient_id, clinic_id, professional_id, prof_user]);
  const agreementId = ag.rows[0].id;
  cleanup.push(['agreements', agreementId]);

  // refresh family token (role now family)
  const famTokF = await tokenFor(famEmail, pw);

  // 6. list-agreements returns the agreement
  const rList = await call('list-agreements', famTokF, {});
  const listIds = (rList.json?.data?.agreements ?? []).map(a => a.id);
  check('list-agreements includes agreement', listIds.includes(agreementId), JSON.stringify(rList.json));

  // 7. toggle-agreement done
  const rTog = await call('toggle-agreement', famTokF, { agreement_id: agreementId, done: true });
  check('toggle done (200)', rTog.status === 200 && rTog.json?.data?.status === 'done', JSON.stringify(rTog.json));

  // 8. IDOR: fam2 (not linked) cannot toggle this agreement
  const fam2Tok = await tokenFor(fam2Email, pw);
  const rIdor = await call('toggle-agreement', fam2Tok, { agreement_id: agreementId, done: false });
  check('IDOR toggle blocked (403)', rIdor.status === 403, JSON.stringify(rIdor.json));

  // 9. IDOR: fam2 list-agreements is empty (not linked / forbidden role)
  const rList2 = await call('list-agreements', fam2Tok, {});
  const empty = (rList2.json?.data?.agreements ?? []).length === 0;
  check('fam2 sees no agreements', rList2.status === 403 || empty, JSON.stringify(rList2.json));

  console.log(`\nRESULT: ${ok} passed, ${fail} failed`);
} catch (e) {
  console.error('ERROR:', e.message);
  fail++;
} finally {
  // cleanup
  for (const [type, id] of cleanup.reverse()) {
    try {
      if (type === 'auth_user') await admin.auth.admin.deleteUser(id);
      else if (type === 'agreements') await c.query('DELETE FROM agreements WHERE id=$1', [id]);
      else await c.query(`DELETE FROM ${type} WHERE id=$1`, [id]);
    } catch (e) { console.log('cleanup warn', type, id, e.message); }
  }
  // remove any pfl/family_members created by link for the smoke users handled by auth_user cascade? pfl.user_id has ON DELETE CASCADE; family_members user_id FK? delete leftovers
  await c.end();
  process.exit(fail > 0 ? 1 : 0);
}
