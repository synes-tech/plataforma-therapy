#!/bin/sh
set -eu

# PostgREST local (mesmo container — evita IAM invoker entre serviços)
export PGRST_SERVER_PORT="${PGRST_SERVER_PORT:-3001}"
export PGRST_DB_SCHEMAS="${PGRST_DB_SCHEMAS:-public}"
export PGRST_DB_ANON_ROLE="${PGRST_DB_ANON_ROLE:-unithery_app}"
export PGRST_DB_EXTRA_SEARCH_PATH="${PGRST_DB_EXTRA_SEARCH_PATH:-public}"

if [ -z "${PGRST_DB_URI:-}" ]; then
  echo "FATAL: PGRST_DB_URI required" >&2
  exit 1
fi
if [ -z "${PGRST_JWT_SECRET:-}" ]; then
  echo "FATAL: PGRST_JWT_SECRET required" >&2
  exit 1
fi

postgrest &
PGRST_PID=$!

export POSTGREST_URL="http://127.0.0.1:${PGRST_SERVER_PORT}"
export PORT="${PORT:-8080}"

# Aguarda PostgREST
i=0
while [ "$i" -lt 30 ]; do
  if wget -qO- "http://127.0.0.1:${PGRST_SERVER_PORT}/" >/dev/null 2>&1 \
    || curl -sf "http://127.0.0.1:${PGRST_SERVER_PORT}/" >/dev/null 2>&1; then
    break
  fi
  i=$((i + 1))
  sleep 1
done

deno run --allow-all --import-map=import_map.json main.ts &
DENO_PID=$!

term() {
  kill -TERM "$DENO_PID" "$PGRST_PID" 2>/dev/null || true
  wait "$DENO_PID" "$PGRST_PID" 2>/dev/null || true
}
trap term INT TERM

wait "$DENO_PID"
term
