#!/usr/bin/env node
/**
 * Importa usuários Supabase (bcrypt) → Identity Platform / Firebase Auth.
 * Pré-requisito: Identity Platform habilitado + GOOGLE_APPLICATION_CREDENTIALS.
 *
 * Uso:
 *   node infra/gcp/scripts/02-import-identity-platform.mjs [--dry-run]
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../../..');
const dryRun = process.argv.includes('--dry-run');

const csvPath = resolve(root, 'infra/gcp/dumps/auth_users_for_idp.csv');
const csv = readFileSync(csvPath, 'utf8').trim().split('\n');
const header = csv.shift().split(',');
const idx = Object.fromEntries(header.map((h, i) => [h, i]));

function parseRow(line) {
  // CSV simples (campos com aspas possíveis)
  const cols = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      cols.push(cur);
      cur = '';
    } else cur += c;
  }
  cols.push(cur);
  return cols;
}

const users = csv.map((line) => {
  const cols = parseRow(line);
  const id = cols[idx.id];
  const email = cols[idx.email];
  let hash = cols[idx.encrypted_password] || '';
  if (hash.startsWith('$2y$')) hash = '$2a$' + hash.slice(4);
  let meta = {};
  try {
    meta = JSON.parse(cols[idx.raw_app_meta_data] || '{}');
  } catch {
    meta = {};
  }
  return {
    uid: id,
    email,
    emailVerified: String(cols[idx.email_verified]).toLowerCase() === 'true',
    passwordHash: Buffer.from(hash),
    customClaims: {
      role: meta.role ?? 'family',
      clinic_id: meta.clinic_id ?? null,
      is_solo: meta.is_solo === true,
    },
  };
}).filter((u) => u.email && u.passwordHash.length > 0);

console.log(`Usuários prontos para import: ${users.length}`);
if (dryRun) {
  console.log('Dry-run — amostra:', users.slice(0, 3).map((u) => ({
    uid: u.uid,
    email: u.email,
    claims: u.customClaims,
    hashPrefix: u.passwordHash.toString('utf8').slice(0, 7),
  })));
  process.exit(0);
}

const require = createRequire(import.meta.url);
let admin;
try {
  admin = require('firebase-admin');
} catch {
  console.error('Instale firebase-admin: npm i firebase-admin');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.GOOGLE_CLOUD_PROJECT || 'plataforma-therapy-ai',
  });
}

const hash = { algorithm: 'BCRYPT' };
const batchSize = 100;
for (let i = 0; i < users.length; i += batchSize) {
  const chunk = users.slice(i, i + batchSize);
  const result = await admin.auth().importUsers(chunk, { hash });
  console.log(`batch ${i}-${i + chunk.length}: success=${result.successCount} errors=${result.failureCount}`);
  if (result.errors?.length) {
    for (const e of result.errors.slice(0, 5)) {
      console.error('  err', e.index, e.error?.message || e);
    }
  }
}

console.log('Import Identity Platform concluído');
