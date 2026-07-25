#!/usr/bin/env node
/**
 * Configura e-mails de autenticação Supabase via Amazon SES (Send Email Hook).
 *
 * Lê SUPABASE_ACCESS_TOKEN do .env na raiz do projeto (se existir).
 *
 * Uso:
 *   node scripts/setup-auth-email-ses.mjs
 */

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
const envPath = resolve(root, '.env');

function loadDotEnv() {
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadDotEnv();

const PROJECT_REF = 'yfzhjdfvaosezyjvbyid';
const HOOK_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/auth-send-email`;

if (!process.env.SUPABASE_ACCESS_TOKEN) {
  console.error('❌ SUPABASE_ACCESS_TOKEN ausente. Adicione ao .env ou exporte a variável.');
  process.exit(1);
}

const secrets = {
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_SES_REGION: process.env.AWS_SES_REGION ?? 'us-east-1',
  AWS_SES_FROM_EMAIL: process.env.AWS_SES_FROM_EMAIL ?? 'contact@unithery.com',
  AWS_SES_FROM_NAME: process.env.AWS_SES_FROM_NAME ?? 'Unithery',
  AWS_SES_CONFIGURATION_SET: process.env.AWS_SES_CONFIGURATION_SET ?? 'my-first-configuration-set',
};

if (process.env.SEND_EMAIL_HOOK_SECRET) {
  secrets.SEND_EMAIL_HOOK_SECRET = process.env.SEND_EMAIL_HOOK_SECRET;
}

console.log('▶ Deploy da Edge Function auth-send-email...');
try {
  execSync('npx supabase functions deploy auth-send-email --no-verify-jwt', {
    stdio: 'inherit',
    cwd: new URL('..', import.meta.url).pathname,
  });
} catch {
  console.error('\n❌ Deploy falhou. Rode: npx supabase login');
  process.exit(1);
}

console.log('\n▶ Configurando secrets no Supabase...');
const secretArgs = Object.entries(secrets)
  .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
  .join(' ');

try {
  execSync(`npx supabase secrets set ${secretArgs}`, {
    stdio: 'inherit',
    cwd: new URL('..', import.meta.url).pathname,
  });
} catch {
  console.error('\n❌ Falha ao setar secrets. Verifique supabase login.');
  process.exit(1);
}

console.log(`
✅ Function deployada e secrets AWS configurados.

⚠️  PASSO MANUAL OBRIGATÓRIO (1 minuto):
   1. Abra: https://supabase.com/dashboard/project/${PROJECT_REF}/auth/hooks
   2. Send Email → Enable hook → HTTPS
   3. URL: ${HOOK_URL}
   4. Clique "Generate Secret" e copie o valor (v1,whsec_...)
   5. Rode novamente com o secret:
      SEND_EMAIL_HOOK_SECRET="v1,whsec_..." node scripts/setup-auth-email-ses.mjs

📧 Remetente: ${secrets.AWS_SES_FROM_EMAIL}
🌎 Região SES: ${secrets.AWS_SES_REGION}

Teste: Authentication → Users → enviar "Reset password" para um usuário de teste.
`);
