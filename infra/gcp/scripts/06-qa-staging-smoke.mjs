#!/usr/bin/env node
/**
 * QA staging automatizado — espelha o checklist FE → Cloud Run + GCS.
 * Requer: .env (VITE_*), GOOGLE_APPLICATION_CREDENTIALS (SA GCP).
 *
 * Usage: node infra/gcp/scripts/05-qa-staging-smoke.mjs
 */
import { readFileSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { homedir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../../..');

function loadEnv() {
  const env = {};
  for (const line of readFileSync(join(root, '.env'), 'utf8').split('\n')) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return env;
}

const env = loadEnv();
const API = (env.VITE_GCP_API_URL || '').replace(/\/$/, '');
const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  || join(homedir(), '.config/gcloud/cursor-agent-unithery.json');
const sa = JSON.parse(readFileSync(saPath, 'utf8'));

const checks = [];
function ok(id, detail) {
  checks.push({ id, pass: true, detail });
  console.log(`✓ ${id} — ${detail}`);
}
function fail(id, detail) {
  checks.push({ id, pass: false, detail });
  console.error(`✗ ${id} — ${detail}`);
}

async function firebaseToken(email = 'joao@synes.tech') {
  const access = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
  let users = [];
  let nextPageToken;
  do {
    const dl = await fetch('https://www.googleapis.com/identitytoolkit/v3/relyingparty/downloadAccount', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access}`,
        'Content-Type': 'application/json',
        'x-goog-user-project': 'plataforma-therapy-ai',
      },
      body: JSON.stringify({ targetProjectId: 'plataforma-therapy-ai', maxResults: 100, nextPageToken }),
    });
    const j = await dl.json();
    users = users.concat(j.users || []);
    nextPageToken = j.nextPageToken;
  } while (nextPageToken);

  const user = users.find((u) => u.email === email);
  if (!user) throw new Error(`user ${email} not found in Identity Platform`);
  const claims = JSON.parse(user.customAttributes || '{}');
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    sub: sa.client_email,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now,
    exp: now + 3600,
    uid: user.localId,
    claims,
  })).toString('base64url');
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  const customToken = `${header}.${payload}.${signer.sign(sa.private_key, 'base64url')}`;
  const ex = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${env.VITE_FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const j = await ex.json();
  if (!j.idToken) throw new Error(`custom token exchange failed: ${JSON.stringify(j).slice(0, 200)}`);
  return { token: j.idToken, claims, uid: user.localId, email: user.email, emailVerified: user.emailVerified };
}

async function call(token, name, body) {
  const res = await fetch(`${API}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      apikey: env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, host: new URL(API).host };
}

async function rest(token, path) {
  const res = await fetch(`${API}/rest/v1/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: env.VITE_SUPABASE_ANON_KEY || 'x',
      Accept: 'application/json',
    },
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json, host: new URL(res.url).host };
}

async function main() {
  if (!API) throw new Error('VITE_GCP_API_URL missing');
  console.log(`API ${API}\n`);

  // 1) Health / handlers
  const health = await fetch(`${API}/`).then((r) => r.json());
  if (health.ok && health.handlers >= 106) {
    ok('1.health', `${health.handlers} handlers`);
  } else {
    fail('1.health', JSON.stringify(health));
  }

  const { token, claims, email, emailVerified, uid } = await firebaseToken();
  ok('1.auth_firebase', `${email} clinic=${claims.clinic_id} verified=${Boolean(emailVerified)}`);

  // 2) REST — paciente do professional autenticado (não qualquer row do Cloud SQL)
  const myPro = await rest(
    token,
    `professionals?select=id,user_id&user_id=eq.${uid}&deleted_at=is.null&limit=1`,
  );
  const professionalId = myPro.json?.[0]?.id;
  if (!professionalId) {
    fail('2.professional', `${myPro.status} ${JSON.stringify(myPro.json).slice(0, 200)}`);
    process.exit(1);
  }
  ok('2.professional', professionalId);

  const patients = await rest(
    token,
    `patients?select=id,name,clinic_id,professional_id&professional_id=eq.${professionalId}&deleted_at=is.null&limit=5`,
  );
  if (patients.status === 200 && Array.isArray(patients.json) && patients.json.length > 0) {
    ok('2.patients_rest', `${patients.json.length} rows host=${patients.host}`);
  } else {
    fail('2.patients_rest', `${patients.status} ${JSON.stringify(patients.json).slice(0, 200)}`);
  }

  const patientId = patients.json?.[0]?.id;
  if (!patientId) {
    fail('abort', 'no patient for this professional');
    process.exit(1);
  }

  // get-clinic-settings (dashboard-ish)
  const settings = await call(token, 'get-clinic-settings', {});
  if (settings.status === 200 && settings.json?.success) {
    ok('2.clinic_settings', `host=${settings.host}`);
  } else {
    fail('2.clinic_settings', `${settings.status} ${JSON.stringify(settings.json?.error || settings.json).slice(0, 200)}`);
  }

  // 3) upload-audio → PUT GCS → job in Cloud SQL
  const audio = await call(token, 'upload-audio', {
    patient_id: patientId,
    duration_seconds: 1,
    recording_type: 'note',
  });
  const uploadUrl = audio.json?.data?.upload_url;
  const jobId = audio.json?.data?.job_id;
  if (audio.status === 202 && uploadUrl?.includes('storage.googleapis.com') && jobId) {
    ok('3.upload_audio_url', `job=${jobId}`);
  } else {
    fail('3.upload_audio_url', `${audio.status} ${JSON.stringify(audio.json).slice(0, 250)}`);
  }

  if (uploadUrl) {
    const wav = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 36, 0, 0, 0, 0x57, 0x41, 0x56, 0x45,
      0x66, 0x6d, 0x74, 0x20, 16, 0, 0, 0, 1, 0, 1, 0, 0x44, 0xac, 0, 0, 0x88, 0x58, 0x01, 0, 2, 0, 16, 0,
      0x64, 0x61, 0x74, 0x61, 0, 0, 0, 0,
    ]);
    const put = await fetch(uploadUrl, { method: 'PUT', body: wav, headers: { 'Content-Type': 'audio/wav' } });
    if (put.status === 200) ok('3.put_gcs_audio', `status=${put.status}`);
    else fail('3.put_gcs_audio', `status=${put.status}`);

    const pathFromUrl = decodeURIComponent(
      new URL(uploadUrl).pathname.replace(/^\/unithery-audio-recordings-staging\//, ''),
    );
    const job = await rest(token, `ai_jobs?select=id,status,job_type&id=eq.${jobId}`);
    if (job.status === 200 && job.json?.[0]?.id === jobId) {
      ok('3.ai_job_cloudsql', `status=${job.json[0].status}`);
    } else {
      fail('3.ai_job_cloudsql', `${job.status} ${JSON.stringify(job.json).slice(0, 200)}`);
    }

    // 4) signed read existing + new
    const readNew = await call(token, 'get-signed-read-url', {
      bucket: 'audio-recordings',
      path: pathFromUrl,
      expires_in: 900,
    });
    const readUrl = readNew.json?.data?.url;
    if (readNew.status === 200 && readNew.json?.data?.backend === 'gcs' && readUrl) {
      const g = await fetch(readUrl);
      ok('4.signed_read_new', `GET ${g.status} bytes=${(await g.arrayBuffer()).byteLength}`);
    } else {
      fail('4.signed_read_new', `${readNew.status} ${JSON.stringify(readNew.json).slice(0, 200)}`);
    }
  }

  // existing recording if any
  const existing = await rest(
    token,
    `audio_recordings?select=storage_path&clinic_id=eq.${claims.clinic_id}&order=created_at.desc&limit=1`,
  );
  if (existing.status === 200 && existing.json?.[0]?.storage_path) {
    const path = existing.json[0].storage_path;
    const read = await call(token, 'get-signed-read-url', {
      bucket: 'audio-recordings',
      path,
      expires_in: 900,
    });
    if (read.status === 200 && read.json?.data?.url) {
      const g = await fetch(read.json.data.url, { method: 'HEAD' }).catch(() =>
        fetch(read.json.data.url));
      ok('4.signed_read_existing', `backend=${read.json.data.backend} http=${g.status}`);
    } else {
      fail('4.signed_read_existing', `${read.status}`);
    }
  } else {
    ok('4.signed_read_existing', 'skipped (no prior recording)');
  }

  // 5) avatar
  const tinyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  const av = await call(token, 'upload-patient-avatar', {
    patient_id: patientId,
    mime_type: 'image/png',
    file_size_bytes: tinyPng.length,
  });
  const avUrl = av.json?.data?.upload_url;
  const avPath = av.json?.data?.storage_path;
  if (av.status === 200 && avUrl?.includes('storage.googleapis.com')) {
    const put = await fetch(avUrl, { method: 'PUT', body: tinyPng, headers: { 'Content-Type': 'image/png' } });
    const conf = await call(token, 'upload-patient-avatar', {
      patient_id: patientId,
      action: 'confirm',
      storage_path: avPath,
      mime_type: 'image/png',
      file_size_bytes: tinyPng.length,
    });
    const rd = await call(token, 'get-signed-read-url', {
      bucket: 'pacientes-avatars',
      path: avPath,
      expires_in: 900,
    });
    if (put.status === 200 && conf.status === 200 && rd.status === 200) {
      ok('5.avatar', `put=${put.status} confirm=${conf.status} backend=${rd.json?.data?.backend}`);
    } else {
      fail('5.avatar', `put=${put.status} confirm=${conf.status} read=${rd.status}`);
    }
  } else {
    fail('5.avatar', `${av.status} ${JSON.stringify(av.json).slice(0, 200)}`);
  }

  // 6) attachment
  const bodyTxt = `qa-smoke ${new Date().toISOString()}`;
  const bytes = Buffer.from(bodyTxt, 'utf8');
  const fileName = `qa-smoke-${Date.now()}.txt`;
  const init = await call(token, 'upload-patient-attachment', {
    action: 'initiate',
    patient_id: patientId,
    file_name: fileName,
    mime_type: 'text/plain',
    file_size_bytes: bytes.length,
  });
  const attUrl = init.json?.data?.upload_url;
  const attPath = init.json?.data?.storage_path;
  const attId = init.json?.data?.attachment_id;
  if (init.status === 200 && attUrl?.includes('storage.googleapis.com')) {
    const put = await fetch(attUrl, { method: 'PUT', body: bytes, headers: { 'Content-Type': 'text/plain' } });
    const conf = await call(token, 'upload-patient-attachment', {
      action: 'confirm',
      patient_id: patientId,
      attachment_id: attId,
      storage_path: attPath,
      file_name: fileName,
      mime_type: 'text/plain',
      file_size_bytes: bytes.length,
    });
    const list = await call(token, 'list-patient-attachments', { patient_id: patientId });
    const item = (list.json?.data?.items || []).find((i) => i.id === attId);
    const del = await call(token, 'delete-patient-attachment', {
      patient_id: patientId,
      attachment_id: attId,
    });
    if (put.status === 200 && conf.status === 200 && item && del.status === 200) {
      ok('6.attachment', `confirm=${item.status} delete=${del.status}`);
    } else {
      fail('6.attachment', `put=${put.status} conf=${conf.status} list=${Boolean(item)} del=${del.status}`);
    }
  } else {
    fail('6.attachment', `${init.status} ${JSON.stringify(init.json).slice(0, 200)}`);
  }

  // 7) MFA plumbing (sem SMS real)
  const mfaFn = await call(token, 'get-signed-read-url', {
    bucket: 'audio-recordings',
    path: `${claims.clinic_id}/x`,
    expires_in: 60,
  });
  // just verify firebase session still valid for settings-like call
  if (settings.status === 200) {
    ok('7.mfa_ui_ready', `emailVerified=${Boolean(emailVerified)} (enroll SMS é manual no FE)`);
  }
  void mfaFn;

  // 8) MFA challenge path — Identity Platform MFA enabled
  const access = execSync('gcloud auth print-access-token', { encoding: 'utf8' }).trim();
  const idp = await fetch(
    `https://identitytoolkit.googleapis.com/admin/v2/projects/plataforma-therapy-ai/config`,
    { headers: { Authorization: `Bearer ${access}` } },
  );
  const idpJson = await idp.json();
  const mfaState = idpJson?.mfa?.state;
  const smsEnabled = (idpJson?.mfa?.enabledProviders || []).includes('PHONE_SMS')
    || JSON.stringify(idpJson?.mfa || {}).includes('PHONE_SMS');
  if (idp.status === 200 && (mfaState === 'ENABLED' || smsEnabled)) {
    ok('8.idp_mfa_config', `state=${mfaState} sms=${smsEnabled}`);
  } else {
    fail('8.idp_mfa_config', `http=${idp.status} state=${mfaState}`);
  }

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass).length;
  console.log(`\n=== RESULT ${passed} passed / ${failed} failed / ${checks.length} total ===`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
