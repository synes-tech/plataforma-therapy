import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv[2];

if (!file) {
  console.error('Usage: node scripts/apply-single-migration.mjs <filename>');
  process.exit(1);
}

const filePath = path.join(__dirname, '..', 'supabase', 'migrations', file);
const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://postgres:123bd-therapy.ai123@db.yfzhjdfvaosezyjvbyid.supabase.co:5432/postgres';

async function run() {
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log(`⏳ Applying: ${file}`);
  try {
    const sql = fs.readFileSync(filePath, 'utf-8');
    await client.query(sql);
    console.log(`✅ Success: ${file}`);
  } catch (err) {
    console.error(`❌ Failed: ${err.message}`);
  } finally {
    await client.end();
  }
}
run();
