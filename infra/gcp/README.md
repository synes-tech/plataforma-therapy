# Infra GCP — Unithery staging → produção

Projeto: `plataforma-therapy-ai` · Região: `us-central1`  
Decisão FE: **GCS + Cloud CDN**  
Plano: [`docs/plano-migracao-supabase-vercel-gcp.md`](../../docs/plano-migracao-supabase-vercel-gcp.md)

## Estado provisionado (Fase 0+)

| Recurso | Nome |
|---------|------|
| Cloud SQL | `unithery-pg-staging` (Postgres 17, Enterprise, pgvector) |
| Artifact Registry | `us-central1-docker.pkg.dev/plataforma-therapy-ai/unithery-docker` |
| SA runtime | `unithery-runtime@plataforma-therapy-ai.iam.gserviceaccount.com` |
| Buckets staging | `unithery-*-staging` + `unithery-fe-staging` |

## Pré-requisitos locais

```bash
export PATH="$HOME/opt/miniforge/bin:$HOME/bin:$HOME/google-cloud-sdk/bin:$PATH"
export GOOGLE_APPLICATION_CREDENTIALS="$HOME/.config/gcloud/cursor-agent-unithery.json"
export CLOUDSDK_PYTHON="$(uv python find 3.12)"
```

Senha DB staging (local, não commitada): `~/.config/gcloud/unithery-pg-staging.password`

## IAM pendente (Owner)

A SA `cursor-agent-480` tem `roles/editor` mas **não** `setIamPolicy` nem `secretmanager.versions.access`.  
Owner deve conceder à `unithery-runtime@...`:

- `roles/cloudsql.client`
- `roles/secretmanager.secretAccessor`
- `roles/storage.objectAdmin`
- `roles/aiplatform.user`
- `roles/logging.logWriter`
- `roles/artifactregistry.reader`

E à `cursor-agent-480@...` (bootstrap): `roles/secretmanager.secretAccessor`.

## Scripts

| Script | Fase |
|--------|------|
| `scripts/00-foundation-check.sh` | 0 |
| `scripts/01-restore-staging.sh` | 1 |
| `scripts/05-deploy-fe-gcs.sh` | 5 |

## Dumps

`dumps/` é gitignored (contém dados clínicos). Gerar com `pg_dump` 17 contra `DATABASE_URL` do Supabase.
