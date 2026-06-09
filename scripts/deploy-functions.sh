#!/bin/bash
# ============================================================
# Therapy.AI — Deploy All Edge Functions
# Agente Backend (2) - Section 6: Automação e Deploy
#
# Usage: ./scripts/deploy-functions.sh
# Prerequisites: supabase CLI logged in + project linked
# ============================================================

set -e

echo "🚀 Deploying Therapy.AI Edge Functions..."
echo "==========================================="

FUNCTIONS=(
  "register-clinic"
  "register-professional"
  "create-patient"
  "generate-invite"
  "validate-invite"
  "submit-diary"
  "upload-audio"
  "process-audio"
  "query-copilot"
)

for func in "${FUNCTIONS[@]}"; do
  echo ""
  echo "📦 Deploying: $func"
  supabase functions deploy "$func" --no-verify-jwt
  echo "✅ $func deployed"
done

echo ""
echo "==========================================="
echo "✅ All ${#FUNCTIONS[@]} functions deployed successfully!"
echo ""
echo "⚙️  Don't forget to set secrets:"
echo "  supabase secrets set OPENAI_API_KEY=sk-..."
echo "  supabase secrets set ENCRYPTION_KEY=..."
echo "  supabase secrets set ALLOWED_ORIGINS=https://your-domain.com"
