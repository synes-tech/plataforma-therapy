/**
 * Conexão com o Cloud SQL de produção (unithery-pg-staging) via Cloud SQL Auth Proxy.
 *
 * Por que este módulo existe: o DATABASE_URL do .env local aponta para o projeto Supabase
 * legado (mantido apenas para rollback). Usá-lo para migrations aplicaria schema no banco
 * errado. Aqui a senha vem do Secret Manager e o host é sempre o proxy local.
 *
 * Pré-requisito: proxy ativo na porta 5433.
 *   .tools/cloud-sql-proxy --token="$(gcloud auth print-access-token)" \
 *     --port 5433 plataforma-therapy-ai:us-central1:unithery-pg-staging
 */
import { execFileSync } from 'node:child_process';
import pg from 'pg';

export const INSTANCE = 'plataforma-therapy-ai:us-central1:unithery-pg-staging';
export const PROXY_PORT = Number(process.env.CLOUDSQL_PROXY_PORT ?? 5433);

function fromSecretManager() {
  try {
    return execFileSync(
      'gcloud',
      ['secrets', 'versions', 'access', 'latest', '--secret=unithery-db-password', '--project=plataforma-therapy-ai'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
  } catch {
    return null;
  }
}

function fromCloudRun() {
  try {
    const env = execFileSync(
      'gcloud',
      [
        'run', 'services', 'describe', 'unithery-api-staging',
        '--region=us-central1',
        '--format=value(spec.template.spec.containers[0].env)',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    return env.match(/postgres:\/\/postgres:([^@]+)@/)?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Candidatas em ordem de confiança. O Secret Manager guarda uma senha que hoje está
 * dessincronizada da que o Cloud Run realmente usa, então tentamos as duas.
 */
export function resolvePasswordCandidates() {
  const candidates = [process.env.CLOUDSQL_PASSWORD, fromCloudRun(), fromSecretManager()]
    .filter(Boolean);
  if (candidates.length === 0) {
    throw new Error(
      'Senha do Cloud SQL não resolvida. Autentique o gcloud ou exporte CLOUDSQL_PASSWORD.',
    );
  }
  return [...new Set(candidates)];
}

export async function connect({ user = 'postgres', database = 'unithery' } = {}) {
  let lastError;
  for (const password of resolvePasswordCandidates()) {
    const client = new pg.Client({
      host: '127.0.0.1',
      port: PROXY_PORT,
      user,
      password,
      database,
      statement_timeout: 300_000,
    });
    try {
      await client.connect();
      return client;
    } catch (error) {
      lastError = error;
      await client.end().catch(() => {});
      if (error.code !== '28P01') throw error;
    }
  }
  throw lastError;
}
