#!/usr/bin/env bash
# HTTPS CDN + cutover DNS — Unithery
# Pré-requisito: adicionar registros DNS na Hostinger (ver echo no final / STATUS.md).
set -euo pipefail
export PATH="${HOME}/bin:${HOME}/google-cloud-sdk/bin:${PATH}"
export GOOGLE_APPLICATION_CREDENTIALS="${GOOGLE_APPLICATION_CREDENTIALS:-$HOME/.config/gcloud/cursor-agent-unithery.json}"
if command -v uv >/dev/null 2>&1; then
  export CLOUDSDK_PYTHON="${CLOUDSDK_PYTHON:-$(uv python find 3.12 2>/dev/null || true)}"
fi
PROJECT_ID="${PROJECT_ID:-plataforma-therapy-ai}"
LB_IP="${LB_IP:-136.69.93.249}"

echo "=== Certificate status ==="
gcloud certificate-manager certificates describe unithery-fe-cert \
  --project="$PROJECT_ID" \
  --format='yaml(managed.state,managed.authorizationAttemptInfo)' 

STATE=$(gcloud certificate-manager certificates describe unithery-fe-cert \
  --project="$PROJECT_ID" --format='value(managed.state)')

echo
echo "=== Forwarding rules ==="
gcloud compute forwarding-rules list --project="$PROJECT_ID" --global \
  --format='table(name,IPAddress,portRange,loadBalancingScheme)'

echo
echo "=== HTTP redirect check ==="
curl -sSI "http://${LB_IP}/" | head -8 || true

if [[ "$STATE" == "ACTIVE" ]]; then
  echo
  echo "=== HTTPS smoke (cert ACTIVE) ==="
  curl -sSI --resolve "unithery.com:443:${LB_IP}" "https://unithery.com/" | head -15 || true
  curl -sSI --resolve "www.unithery.com:443:${LB_IP}" "https://www.unithery.com/" | head -15 || true
else
  echo
  echo "Cert ainda PROVISIONING. Adicione na Hostinger (DNS):"
  echo
  echo "1) Validação do certificado (obrigatório ANTES do A record de cutover):"
  echo "   CNAME  _acme-challenge.unithery.com      →  4c0b31a9-76f8-4e74-acf0-646661b73d4c.2.authorize.certificatemanager.goog."
  echo "   CNAME  _acme-challenge.www.unithery.com  →  ed3bc513-f176-4102-88d9-69e94ed86720.8.authorize.certificatemanager.goog."
  echo
  echo "2) Cutover de tráfego FE (após cert ACTIVE — ou em paralelo se aceitar janela HTTP):"
  echo "   A      @ (unithery.com)   →  ${LB_IP}"
  echo "   A      www                →  ${LB_IP}"
  echo "   (remova CNAME/A antigos da Vercel)"
  echo
  echo "3) Conferir:"
  echo "   bash infra/gcp/scripts/07-cdn-https-cutover.sh"
fi

echo
echo "API permanece em Cloud Run (HTTPS nativo):"
echo "  https://unithery-api-staging-708489350104.us-central1.run.app"
echo "Stripe webhook (manual no Dashboard Stripe):"
echo "  https://unithery-api-staging-708489350104.us-central1.run.app/functions/v1/stripe-webhook"
echo "  (+ stripe-test-webhook se usar página de teste)"
