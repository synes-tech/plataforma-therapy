#!/usr/bin/env bash
# Build Vite e publica em GCS staging (origem do Cloud CDN).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
export PATH="${HOME}/bin:${HOME}/google-cloud-sdk/bin:${PATH}"
export GOOGLE_APPLICATION_CREDENTIALS="${GOOGLE_APPLICATION_CREDENTIALS:-$HOME/.config/gcloud/cursor-agent-unithery.json}"
if command -v uv >/dev/null 2>&1; then
  export CLOUDSDK_PYTHON="${CLOUDSDK_PYTHON:-$(uv python find 3.12 2>/dev/null || true)}"
fi
PROJECT_ID="${PROJECT_ID:-plataforma-therapy-ai}"
BUCKET="${FE_BUCKET:-unithery-fe-staging}"
API_URL="${VITE_API_BASE:-https://unithery-api-staging-708489350104.us-central1.run.app}"

cd "$ROOT"

# Carrega VITE_* do .env (Firebase, anon key, etc.) sem source frágil
eval "$(python3 - <<'PY'
from pathlib import Path
import shlex
for line in Path('.env').read_text().splitlines():
    if not line.startswith('VITE_') or '=' not in line:
        continue
    key, value = line.split('=', 1)
    if key == 'VITE_SUPABASE_URL':
        continue
    print(f'export {key}={shlex.quote(value)}')
PY
)"

# Staging GCS: supabase-js + callFunction → Cloud Run (Cloud SQL / GCS dual / Identity)
export VITE_SUPABASE_URL="$API_URL"
export VITE_GCP_API_URL="$API_URL"

echo "Building FE staging…"
echo "  VITE_SUPABASE_URL=$VITE_SUPABASE_URL"
echo "  VITE_GCP_API_URL=$VITE_GCP_API_URL"
echo "  VITE_FIREBASE_PROJECT_ID=${VITE_FIREBASE_PROJECT_ID:-<missing>}"

npm run build

# -r obrigatório: sem isso o rsync pode publicar só a raiz (sem assets/icons)
gcloud storage rsync -r --delete-unmatched-destination-objects \
  "$ROOT/dist" "gs://${BUCKET}" \
  --project="$PROJECT_ID"

gcloud storage objects update "gs://${BUCKET}/index.html" \
  --cache-control="no-cache, max-age=0" --project="$PROJECT_ID" || true

# SPA: 404 → index.html (rotas públicas como /ajuda, /login)
gcloud storage buckets update "gs://${BUCKET}" \
  --web-main-page-suffix=index.html \
  --web-error-page=index.html \
  --project="$PROJECT_ID" || true
gcloud storage cp "gs://${BUCKET}/index.html" "gs://${BUCKET}/ajuda" \
  --cache-control="no-cache, max-age=0" \
  --project="$PROJECT_ID" || true

echo "FE publicado em gs://${BUCKET}"
echo "  https://storage.googleapis.com/${BUCKET}/index.html"
echo "  CDN: http://136.69.93.249/"
echo "API: $API_URL"
