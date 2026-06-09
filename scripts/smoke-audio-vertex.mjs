import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { readFileSync } from 'node:fs';

const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB = process.env.DATABASE_URL;
const WAV = process.env.WAV_PATH || '/tmp/sessao.wav';

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

let ok = 0, fail = 0;
const check = (n, c, e = '') => { if (c) { ok++; console.log('  PASS', n); } else { fail++; console.log('  FAIL', n, e); } };

const c = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
const created = { recId: null, jobId: null, transId: null, noteId: null };
try {
  await c.connect();
  const { rows } = await c.query(`
    SELECT prof.id prof_id, prof.clinic_id, prof.user_id, u.email, pat.id patient_id
    FROM professionals prof JOIN auth.users u ON prof.user_id=u.id
    JOIN patients pat ON pat.professional_id=prof.id
    WHERE prof.deleted_at IS NULL AND pat.deleted_at IS NULL LIMIT 1`);
  const { prof_id, clinic_id, email, patient_id } = rows[0];
  console.log('Professional:', email, '| patient:', patient_id);

  // 1. Cria audio_recording + ai_job via service client (replica o que upload-audio grava)
  const storagePath = `${clinic_id}/${patient_id}/${Date.now()}.wav`;
  const recIns = await admin.from('audio_recordings').insert({
    patient_id, professional_id: prof_id, clinic_id, storage_path: storagePath,
    duration_seconds: 18, mime_type: 'audio/wav', recording_type: 'post_session', status: 'uploading',
  }).select('id').single();
  check('cria audio_recording', !recIns.error, recIns.error?.message);
  created.recId = recIns.data?.id;
  const jobIns = await admin.from('ai_jobs').insert({
    patient_id, clinic_id, professional_id: prof_id, job_type: 'transcribe', status: 'pending',
    input_data: { audio_recording_id: created.recId, patient_id, storage_path: storagePath, recording_type: 'post_session' },
  }).select('id').single();
  check('cria ai_job', !jobIns.error, jobIns.error?.message);
  created.jobId = jobIns.data?.id;

  // 2. Upload dos bytes WAV no Storage (service role)
  const wavBytes = readFileSync(WAV);
  const upRes = await admin.storage.from('audio-recordings').upload(storagePath, wavBytes, {
    contentType: 'audio/wav', upsert: true,
  });
  check('upload WAV no Storage', !upRes.error, upRes.error?.message);

  // 3. process-audio → transcreve + SOAP + embeddings via Vertex
  console.log('  ... chamando process-audio (Vertex transcricao + SOAP + embeddings)');
  const pr = await call('process-audio', SERVICE, {
    audio_recording_id: created.recId, patient_id, job_id: created.jobId,
  });
  check('process-audio (200)', pr.status === 200, JSON.stringify(pr.json).slice(0, 300));
  created.transId = pr.json?.data?.transcription_id;
  created.noteId = pr.json?.data?.session_note_id;
  check('embeddings gerados (>=1)', (pr.json?.data?.embeddings_count ?? 0) >= 1, JSON.stringify(pr.json?.data));

  // 4. verificacao no banco
  const { rows: tr } = await c.query('SELECT raw_text, word_count, model_version FROM audio_transcriptions WHERE id=$1', [created.transId]);
  check('transcricao salva com texto', tr[0] && tr[0].word_count > 0, JSON.stringify(tr[0])?.slice(0, 120));
  console.log('     transcricao >>', String(tr[0]?.raw_text).slice(0, 180).replace(/\n/g, ' '));
  console.log('     model_version >>', tr[0]?.model_version);

  const { rows: sn } = await c.query('SELECT status, content, llm_model FROM session_notes WHERE id=$1', [created.noteId]);
  const soap = sn[0]?.content || {};
  check('session_note draft', sn[0]?.status === 'draft', sn[0]?.status);
  check('SOAP preenchido (S/O/A/P)', !!(soap.subjective && soap.objective && soap.assessment && soap.plan));
  console.log('     SOAP.subjective >>', String(soap.subjective).slice(0, 140).replace(/\n/g, ' '));
  console.log('     SOAP.plan       >>', String(soap.plan).slice(0, 140).replace(/\n/g, ' '));

  const { rows: emb } = await c.query("SELECT count(*)::int n, vector_dims(embedding) dims FROM patient_embeddings WHERE source_id=$1 GROUP BY dims", [created.noteId]);
  check('embeddings 768d no pgvector', emb[0]?.dims === 768 && emb[0]?.n >= 1, JSON.stringify(emb[0]));

  console.log(`\nRESULT: ${ok} passed, ${fail} failed`);
} catch (e) {
  console.error('ERROR:', e.message); fail++;
} finally {
  // cleanup
  try {
    if (created.noteId) await c.query('DELETE FROM patient_embeddings WHERE source_id=$1', [created.noteId]);
    if (created.noteId) await c.query('DELETE FROM session_notes WHERE id=$1', [created.noteId]);
    if (created.transId) await c.query('DELETE FROM audio_transcriptions WHERE id=$1', [created.transId]);
    if (created.recId) await c.query('DELETE FROM audio_recordings WHERE id=$1', [created.recId]);
    if (created.jobId) await c.query('DELETE FROM ai_jobs WHERE id=$1', [created.jobId]);
    console.log('cleanup: registros de teste removidos');
  } catch (ce) { console.error('cleanup falhou:', ce.message); }
  await c.end();
  process.exit(fail > 0 ? 1 : 0);
}
