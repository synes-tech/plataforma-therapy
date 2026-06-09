import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { readFileSync } from 'node:fs';

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB = process.env.DATABASE_URL;
const WAV = process.env.WAV_PATH || '/tmp/sessao.wav';

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

async function call(fn, token, body) {
  const res = await fetch(`${URL}/functions/v1/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: ANON },
    body: JSON.stringify(body ?? {}),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

let ok = 0, fail = 0;
const check = (n, c, e = '') => { if (c) { ok++; console.log('  PASS', n); } else { fail++; console.log('  FAIL', n, e); } };

const c = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
const created = { recId: null, jobId: null, transId: null, noteId: null };
try {
  await c.connect();
  const { rows } = await c.query(`
    SELECT prof.user_id, u.email, pat.id patient_id
    FROM professionals prof JOIN auth.users u ON prof.user_id=u.id
    JOIN patients pat ON pat.professional_id=prof.id
    WHERE prof.deleted_at IS NULL AND pat.deleted_at IS NULL LIMIT 1`);
  const { user_id, email, patient_id } = rows[0];

  await admin.auth.admin.updateUserById(user_id, { password: 'SmokeVertex123!' });
  const cli = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: signIn, error } = await cli.auth.signInWithPassword({ email, password: 'SmokeVertex123!' });
  if (error) throw new Error('signIn: ' + error.message);
  const token = signIn.session.access_token;
  console.log('Professional:', email, '| patient:', patient_id);

  // 1. upload-audio REAL (RLS via user client) — antes dava FORBIDDEN
  const up = await call('upload-audio', token, { patient_id, recording_type: 'post_session', duration_seconds: 18 });
  check('upload-audio (200) [RLS fix]', up.status === 200, JSON.stringify(up.json).slice(0, 200));
  created.recId = up.json?.data?.audio_recording_id;
  created.jobId = up.json?.data?.job_id;
  const uploadUrl = up.json?.data?.upload_url;
  check('retornou signed upload_url + ids', !!created.recId && !!created.jobId && !!uploadUrl);

  // 2. upload do WAV pela signed URL (fluxo real do cliente)
  const wavBytes = readFileSync(WAV);
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'audio/wav', 'x-upsert': 'true' },
    body: wavBytes,
  });
  check('upload WAV via signed URL', putRes.ok, 'status ' + putRes.status);

  // 3. process-audio (Vertex)
  console.log('  ... process-audio (Vertex)');
  const pr = await call('process-audio', SERVICE, { audio_recording_id: created.recId, patient_id, job_id: created.jobId });
  check('process-audio (200)', pr.status === 200, JSON.stringify(pr.json).slice(0, 250));
  created.transId = pr.json?.data?.transcription_id;
  created.noteId = pr.json?.data?.session_note_id;
  check('SOAP + embeddings gerados', (pr.json?.data?.embeddings_count ?? 0) >= 1, JSON.stringify(pr.json?.data));

  console.log(`\nRESULT: ${ok} passed, ${fail} failed`);
} catch (e) {
  console.error('ERROR:', e.message); fail++;
} finally {
  try {
    if (created.noteId) await c.query('DELETE FROM patient_embeddings WHERE source_id=$1', [created.noteId]);
    if (created.noteId) await c.query('DELETE FROM session_notes WHERE id=$1', [created.noteId]);
    if (created.transId) await c.query('DELETE FROM audio_transcriptions WHERE id=$1', [created.transId]);
    if (created.recId) await c.query('DELETE FROM audio_recordings WHERE id=$1', [created.recId]);
    if (created.jobId) await c.query('DELETE FROM ai_jobs WHERE id=$1', [created.jobId]);
    console.log('cleanup ok');
  } catch (ce) { console.error('cleanup falhou:', ce.message); }
  await c.end();
  process.exit(fail > 0 ? 1 : 0);
}
