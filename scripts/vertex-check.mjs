import crypto from 'node:crypto';
import fs from 'node:fs';

const sa = JSON.parse(fs.readFileSync('plataforma-therapy-ai-6f0616f4c4c7.json', 'utf8'));
const LOCATION = process.env.GCP_LOCATION || 'us-central1';

function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  }));
  const signingInput = `${header}.${claim}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(signingInput), sa.private_key)
    .toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const jwt = `${signingInput}.${signature}`;

  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error('token: ' + JSON.stringify(json));
  return json.access_token;
}

const base = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${sa.project_id}/locations/${LOCATION}/publishers/google/models`;

(async () => {
  console.log('project:', sa.project_id, '| location:', LOCATION);
  const token = await getToken();
  console.log('PASS  access token obtido (len', token.length, ')');

  // 1. generateContent gemini-2.5-pro
  const gen = await fetch(`${base}/gemini-2.5-pro:generateContent`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Responda apenas: OK' }] }] }),
  });
  const genJson = await gen.json();
  if (!gen.ok) { console.log('FAIL  generateContent', gen.status, JSON.stringify(genJson).slice(0, 400)); }
  else { console.log('PASS  generateContent:', JSON.stringify(genJson.candidates?.[0]?.content?.parts?.[0]?.text)); }

  // 2. embeddings gemini-embedding-001 :predict (768)
  const emb = await fetch(`${base}/gemini-embedding-001:predict`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ content: 'teste de embedding clinico', task_type: 'RETRIEVAL_QUERY' }],
      parameters: { outputDimensionality: 768 },
    }),
  });
  const embJson = await emb.json();
  if (!emb.ok) { console.log('FAIL  embeddings', emb.status, JSON.stringify(embJson).slice(0, 400)); }
  else {
    const vec = embJson.predictions?.[0]?.embeddings?.values;
    console.log('PASS  embeddings dims:', vec?.length);
  }
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
