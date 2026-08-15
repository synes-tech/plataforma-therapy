#!/usr/bin/env bash
# Restaura dumps em Cloud SQL staging (requer proxy + dumps/ + pg 17).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
DUMP_DIR="$ROOT/infra/gcp/dumps"
SQL_DIR="$ROOT/infra/gcp/sql"
export PATH="${HOME}/opt/miniforge/bin:${HOME}/bin:${HOME}/google-cloud-sdk/bin:${PATH}"
export GOOGLE_APPLICATION_CREDENTIALS="${GOOGLE_APPLICATION_CREDENTIALS:-$HOME/.config/gcloud/cursor-agent-unithery.json}"
export CLOUDSDK_PYTHON="${CLOUDSDK_PYTHON:-$(uv python find 3.12)}"
PROJECT_ID="${PROJECT_ID:-plataforma-therapy-ai}"
REGION="${REGION:-us-central1}"
INSTANCE="${INSTANCE:-unithery-pg-staging}"
DB_PASS="$(cat "$HOME/.config/gcloud/unithery-pg-staging.password")"
export PGPASSWORD="$DB_PASS"
CONN="host=127.0.0.1 port=5433 user=postgres dbname=unithery sslmode=disable"

pkill -f "cloud-sql-proxy.*${INSTANCE}" 2>/dev/null || true
sleep 1
"$HOME/bin/cloud-sql-proxy" "${PROJECT_ID}:${REGION}:${INSTANCE}" --port=5433 \
  --credentials-file="$GOOGLE_APPLICATION_CREDENTIALS" >/tmp/cloud-sql-proxy.log 2>&1 &
sleep 3

psql "$CONN" -v ON_ERROR_STOP=1 -f "$SQL_DIR/001_auth_compat.sql"
pg_restore --dbname="$CONN" --no-owner --no-privileges --clean --if-exists "$DUMP_DIR/auth_users.dump" || true
pg_restore --dbname="$CONN" --no-owner --no-privileges "$DUMP_DIR/public.dump" || true
pg_restore -l "$DUMP_DIR/public.dump" | grep -E ' POLICY | ACL ' > /tmp/public_policies.list
pg_restore --dbname="$CONN" --no-owner --use-list=/tmp/public_policies.list "$DUMP_DIR/public.dump" || true

psql "$CONN" -v ON_ERROR_STOP=1 <<SQL
GRANT ALL ON SCHEMA public TO unithery_app;
GRANT ALL ON ALL TABLES IN SCHEMA public TO unithery_app;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO unithery_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO unithery_app;
ALTER ROLE unithery_app WITH BYPASSRLS;
GRANT unithery_app TO postgres;
SQL

psql "$CONN" -c "SELECT count(*) AS policies FROM pg_policies WHERE schemaname='public';"
echo "OK restore staging"
