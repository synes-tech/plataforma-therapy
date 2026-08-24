/**
 * Aplica uma migration SQL no Cloud SQL de produção.
 *
 *   node scripts/apply-cloudsql-migration.mjs 20260822160000_b2b_b2c_portal_foundation.sql
 *
 * A migration deve ser idempotente e trazer seu próprio BEGIN/COMMIT quando precisar de
 * atomicidade — este runner envia o arquivo como um único comando, preservando o controle
 * transacional escrito no SQL.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { connect } from './cloudsql-connect.mjs';

const file = process.argv[2];
if (!file) {
  console.error('Uso: node scripts/apply-cloudsql-migration.mjs <arquivo.sql>');
  process.exit(1);
}

const path = file.includes('/') ? resolve(file) : resolve('supabase/migrations', file);
const sql = readFileSync(path, 'utf8');

const client = await connect();

client.on('notice', (n) => console.log(`  [notice] ${n.message}`));

const startedAt = Date.now();
try {
  console.log(`Aplicando ${path}`);
  console.log(`  ${sql.split('\n').length} linhas, ${(sql.length / 1024).toFixed(1)} KB`);
  await client.query(sql);
  console.log(`OK em ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
} catch (error) {
  console.error('\nFALHOU');
  console.error(`  ${error.message}`);
  if (error.position) {
    const pos = Number(error.position);
    const upTo = sql.slice(0, pos);
    const line = upTo.split('\n').length;
    console.error(`  linha ~${line}`);
    console.error(`  contexto: ...${sql.slice(Math.max(0, pos - 220), pos + 120).trim()}`);
  }
  if (error.detail) console.error(`  detalhe: ${error.detail}`);
  if (error.hint) console.error(`  dica: ${error.hint}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
