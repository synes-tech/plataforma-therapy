#!/bin/bash
# Unithery — Deploy Iniciativa 2.7 (Identidade de Dependentes)
set -e

echo "═══════════════════════════════════════════════════════════"
echo "  Iniciativa 2.7 — Identidade de Dependentes"
echo "═══════════════════════════════════════════════════════════"

echo ""
echo "▶ Migration dependentes"
node scripts/apply-single-migration.mjs 20260709100000_patient_dependent_identity.sql

echo ""
echo "▶ Edge Functions"
npx supabase functions deploy verify-patient-cpf --no-verify-jwt
npx supabase functions deploy create-patient --no-verify-jwt
npx supabase functions deploy list-patients --no-verify-jwt
npx supabase functions deploy get-archived-patients --no-verify-jwt
npx supabase functions deploy query-copilot --no-verify-jwt

echo ""
echo "✅ Deploy 2.7 concluído"
