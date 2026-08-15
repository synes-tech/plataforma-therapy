#!/usr/bin/env bash
# Proxy /__/auth/* no CDN → Firebase Auth handler.
# Faz o Google mostrar "Prosseguir para unithery.com" em vez de *.firebaseapp.com.
set -euo pipefail
export PATH="${HOME}/bin:${HOME}/google-cloud-sdk/bin:${PATH}"
export GOOGLE_APPLICATION_CREDENTIALS="${GOOGLE_APPLICATION_CREDENTIALS:-$HOME/.config/gcloud/cursor-agent-unithery.json}"
if command -v uv >/dev/null 2>&1; then
  export CLOUDSDK_PYTHON="${CLOUDSDK_PYTHON:-$(uv python find 3.12 2>/dev/null || true)}"
fi

PROJECT_ID="${PROJECT_ID:-plataforma-therapy-ai}"
AUTH_ORIGIN="${AUTH_ORIGIN:-plataforma-therapy-ai.firebaseapp.com}"
NEG_NAME="${NEG_NAME:-firebase-auth-neg}"
BS_NAME="${BS_NAME:-firebase-auth-bs}"
URL_MAP="${URL_MAP:-unithery-fe-staging-map}"

echo "=== Internet NEG ${NEG_NAME} → ${AUTH_ORIGIN}:443 ==="
if ! gcloud compute network-endpoint-groups describe "$NEG_NAME" --global --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud compute network-endpoint-groups create "$NEG_NAME" \
    --network-endpoint-type=INTERNET_FQDN_PORT \
    --global \
    --project="$PROJECT_ID"
  gcloud compute network-endpoint-groups update "$NEG_NAME" \
    --add-endpoint="fqdn=${AUTH_ORIGIN},port=443" \
    --global \
    --project="$PROJECT_ID"
else
  echo "NEG já existe."
fi

echo "=== Backend service ${BS_NAME} ==="
if gcloud compute backend-services describe "$BS_NAME" --global --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo "Backend já existe — Host do origin Firebase."
  gcloud compute backend-services update "$BS_NAME" \
    --global \
    --project="$PROJECT_ID" \
    --custom-request-header="Host: ${AUTH_ORIGIN}"
else
  gcloud compute backend-services create "$BS_NAME" \
    --load-balancing-scheme=EXTERNAL_MANAGED \
    --protocol=HTTPS \
    --global \
    --timeout=30s \
    --no-enable-cdn \
    --project="$PROJECT_ID" \
    --custom-request-header="Host: ${AUTH_ORIGIN}"

  gcloud compute backend-services add-backend "$BS_NAME" \
    --global \
    --network-endpoint-group="$NEG_NAME" \
    --global-network-endpoint-group \
    --project="$PROJECT_ID"
fi

echo "=== Route /__/auth no URL map ${URL_MAP} ==="
TMP="$(mktemp)"
gcloud compute url-maps export "$URL_MAP" --destination="$TMP" --project="$PROJECT_ID" --global
if grep -q "$BS_NAME" "$TMP" && grep -q "prefixMatch: /__/auth" "$TMP"; then
  echo "Route /__/auth já presente."
else
  echo "ATENÇÃO: route /__/auth ausente no URL map. Inserir manualmente (routeRules)."
fi
rm -f "$TMP"

echo
echo "=== Smoke GET handler ==="
BODY="$(curl -sS "https://unithery.com/__/auth/handler" | head -c 200)"
echo "$BODY"
if echo "$BODY" | grep -q "fireauth.oauthhelper"; then
  echo "OK: handler Firebase em https://unithery.com/__/auth/handler"
else
  echo "FALHA: handler não parece o do Firebase."
  exit 1
fi

echo
echo "FE: VITE_FIREBASE_AUTH_DOMAIN=unithery.com"
echo "OAuth: adicionar https://unithery.com/__/auth/handler no client Web"
