import pg from 'pg';
import { writeFileSync } from 'node:fs';

const DB = process.env.DATABASE_URL;
const APPLY = process.argv.includes('--apply');

function transform(expr) {
  if (!expr) return expr;
  return expr
    .replaceAll("auth.jwt() ->> 'role'::text", "auth.jwt() -> 'app_metadata' ->> 'role'::text")
    .replaceAll("auth.jwt() ->> 'clinic_id'::text", "auth.jwt() -> 'app_metadata' ->> 'clinic_id'::text");
}

function parseRoles(roles) {
  if (Array.isArray(roles)) return roles;
  // pg text[] como string "{public}" ou "{authenticated,anon}"
  return String(roles).replace(/^\{|\}$/g, '').split(',').filter(Boolean);
}

const c = new pg.Client({ connectionString: DB, ssl: { rejectUnauthorized: false } });
await c.connect();

const { rows } = await c.query(`
  SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
  FROM pg_policies
  WHERE schemaname='public'
    AND (qual LIKE '%auth.jwt%' OR with_check LIKE '%auth.jwt%')
    AND (
      coalesce(qual,'') LIKE '%->> ''role''%' OR coalesce(qual,'') LIKE '%->> ''clinic_id''%'
      OR coalesce(with_check,'') LIKE '%->> ''role''%' OR coalesce(with_check,'') LIKE '%->> ''clinic_id''%'
    )
  ORDER BY tablename, policyname`);

let sql = `-- Corrige RLS: claims devem vir de app_metadata (Supabase nao expoe role/clinic_id\n`;
sql += `-- como claims top-level; 'role' top-level e reservado para o Postgres role).\n`;
sql += `-- Gerado automaticamente por scripts/fix-rls-app-metadata.mjs.\nBEGIN;\n\n`;

let changed = 0;
for (const p of rows) {
  const newQual = transform(p.qual);
  const newCheck = transform(p.with_check);
  if (newQual === p.qual && newCheck === p.with_check) continue;
  changed++;
  const roles = parseRoles(p.roles).join(', ');
  const tbl = `public."${p.tablename}"`;
  sql += `DROP POLICY IF EXISTS "${p.policyname}" ON ${tbl};\n`;
  sql += `CREATE POLICY "${p.policyname}" ON ${tbl}\n`;
  sql += `  AS ${p.permissive} FOR ${p.cmd} TO ${roles}`;
  if (newQual) sql += `\n  USING (${newQual})`;
  if (newCheck) sql += `\n  WITH CHECK (${newCheck})`;
  sql += `;\n\n`;
}
sql += `COMMIT;\n`;

const outFile = 'supabase/migrations/20260609200000_rls_app_metadata_claims.sql';
writeFileSync(outFile, sql);
console.log(`Policies afetadas: ${changed} / ${rows.length}`);
console.log(`Migração escrita em: ${outFile}`);

if (APPLY) {
  console.log('\nAplicando no banco (transação)...');
  await c.query(sql);
  console.log('OK aplicado.');
  // verificação: nenhuma policy deve mais referenciar o claim top-level
  const { rows: leftover } = await c.query(`
    SELECT count(*)::int n FROM pg_policies
    WHERE schemaname='public'
      AND ( coalesce(qual,'') ~ 'jwt\\(\\) ->> ''(role|clinic_id)'''
         OR coalesce(with_check,'') ~ 'jwt\\(\\) ->> ''(role|clinic_id)''' )`);
  console.log('policies ainda com claim top-level (deve ser 0):', leftover[0].n);
} else {
  console.log('\n(dry-run) rode com --apply para executar.');
}
await c.end();
