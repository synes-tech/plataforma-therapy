#!/bin/bash
# Therapy.AI — Deploy de todas as Edge Functions (CORS global via _shared/cors.ts)
# Uso: ./scripts/deploy-functions.sh
# Pré-requisito: npx supabase login && npx supabase link --project-ref <ref>

set -e

FUNCTIONS=(
  "register-clinic"
  "register-family"
  "register-professional"
  "create-patient"
  "list-patients"
  "list-professionals"
  "update-professional"
  "generate-invite"
  "validate-invite"
  "link-family-account"
  "submit-diary"
  "upload-audio"
  "process-audio"
  "query-copilot"
  "get-clinic-dashboard"
  "get-clinic-settings"
  "update-clinic-settings"
  "list-invoices"
  "get-professional-morning-briefing"
  "list-pending-evolutions"
  "get-daily-sessions"
  "get-monthly-summary"
  "reschedule-session"
  "list-agreements"
  "toggle-agreement"
  "create-agreement"
)

echo "Deploying ${#FUNCTIONS[@]} Edge Functions..."
for func in "${FUNCTIONS[@]}"; do
  echo ">> $func"
  npx supabase functions deploy "$func" --no-verify-jwt
done
echo "Done."
