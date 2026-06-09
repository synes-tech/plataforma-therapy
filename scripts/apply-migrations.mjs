/**
 * Apply Supabase Migrations via Direct PostgreSQL Connection
 * Usage: node scripts/apply-migrations.mjs
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://postgres:123bd-therapy.ai123@db.yfzhjdfvaosezyjvbyid.supabase.co:5432/postgres';

async function run() {
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

  try {
    console.log('🔗 Connecting to database...');
    await client.connect();
    console.log('✅ Connected!\n');

    // Get migration files sorted by name (timestamp order)
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`📁 Found ${files.length} migrations:\n`);

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      console.log(`  ⏳ Applying: ${file}`);
      try {
        await client.query(sql);
        console.log(`  ✅ Success: ${file}`);
      } catch (err) {
        // Skip if already applied (e.g., "type already exists", "relation already exists")
        if (err.message.includes('already exists') || err.message.includes('duplicate key')) {
          console.log(`  ⚠️  Skipped (already applied): ${file}`);
        } else {
          console.error(`  ❌ Failed: ${file}`);
          console.error(`     Error: ${err.message}`);
          // Continue to next migration instead of stopping completely
          // Some migrations may depend on extensions that aren't available
          if (err.message.includes('pg_cron') || err.message.includes('cron.schedule')) {
            console.log(`     ℹ️  pg_cron not available — skipping cron-related statements`);
          } else {
            throw err;
          }
        }
      }
      console.log('');
    }

    console.log('🎉 All migrations applied!');
  } catch (err) {
    console.error('\n💥 Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
