#!/usr/bin/env node
/**
 * Sync Supabase Storage → GCS staging (best-effort).
 * Requer: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_APPLICATION_CREDENTIALS
 *
 * Mapa:
 *   audio-recordings      → unithery-audio-recordings-staging
 *   family-diary-audio    → unithery-family-diary-audio-staging
 *   pacientes-anexos      → unithery-pacientes-anexos-staging
 *   pacientes-avatars     → unithery-pacientes-avatars-staging
 *   profissionais-avatars → unithery-profissionais-avatars-staging
 */
import { createClient } from '@supabase/supabase-js';
import { Storage } from '@google-cloud/storage';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../../..');

function loadEnv() {
  const env = {};
  for (const line of readFileSync(resolve(root, '.env'), 'utf8').split('\n')) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return env;
}

const MAP = [
  ['audio-recordings', 'unithery-audio-recordings-staging'],
  ['family-diary-audio', 'unithery-family-diary-audio-staging'],
  ['pacientes-anexos', 'unithery-pacientes-anexos-staging'],
  ['pacientes-avatars', 'unithery-pacientes-avatars-staging'],
  ['profissionais-avatars', 'unithery-profissionais-avatars-staging'],
];

const env = loadEnv();
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const storage = new Storage({ projectId: 'plataforma-therapy-ai' });
const dryRun = process.argv.includes('--dry-run');
const limit = Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] || 50);

async function listAll(bucket, prefix = '') {
  const out = [];
  const { data, error } = await supabase.storage.from(bucket).list(prefix, {
    limit: 100,
    offset: 0,
  });
  if (error) throw error;
  for (const item of data || []) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null) {
      // folder
      out.push(...await listAll(bucket, path));
    } else {
      out.push(path);
    }
  }
  return out;
}

let copied = 0;
let skipped = 0;
let errors = 0;

for (const [src, dst] of MAP) {
  console.log(`\n=== ${src} → gs://${dst} ===`);
  let files = [];
  try {
    files = await listAll(src);
  } catch (e) {
    console.error('list failed', src, e.message || e);
    errors++;
    continue;
  }
  console.log(`objetos encontrados: ${files.length} (limit sync=${limit})`);
  const bucket = storage.bucket(dst);
  for (const path of files.slice(0, limit)) {
    try {
      const { data, error } = await supabase.storage.from(src).download(path);
      if (error) throw error;
      const buf = Buffer.from(await data.arrayBuffer());
      if (dryRun) {
        console.log('dry-run', path, buf.length);
        skipped++;
        continue;
      }
      await bucket.file(path).save(buf, { resumable: false });
      copied++;
      if (copied % 10 === 0) console.log(`copied ${copied}...`);
    } catch (e) {
      console.error('fail', path, e.message || e);
      errors++;
    }
  }
}

console.log(JSON.stringify({ copied, skipped, errors, dryRun }, null, 2));
