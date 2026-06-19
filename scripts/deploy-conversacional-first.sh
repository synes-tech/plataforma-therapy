#!/bin/bash
# Unithery — Deploy do Master Plan "Conversacional First" (Fases 1–5)
# Uso: ./scripts/deploy-conversacional-first.sh
# Pré-requisito: npx supabase login && projeto linkado + .env com DATABASE_URL

set -e

echo "═══════════════════════════════════════════════════════════"
echo "  Conversacional First — Deploy (Fases 1–5)"
echo "═══════════════════════════════════════════════════════════"

# ── Fase 1: Copiloto como landing tab ───────────────────────
# Frontend only (rotas /patients/:id/copilot). Sem backend.

# ── Fase 2: UI de chat contextualizado ──────────────────────
# query-copilot já existia (conversation_history). Redeploy na Fase 5.

# ── Fase 3: Save As nos balões da IA ────────────────────────
echo ""
echo "▶ Fase 3 — Migration artefatos IA"
node scripts/apply-single-migration.mjs 20260704100000_ai_artifacts_saved.sql

echo ""
echo "▶ Fase 3 — Edge Functions"
npx supabase functions deploy save-ai-artifact --no-verify-jwt
npx supabase functions deploy list-ai-artifact-status --no-verify-jwt

# ── Fase 4: Galeria Documentos Salvos ───────────────────────
echo ""
echo "▶ Fase 4 — Edge Function"
npx supabase functions deploy get-patient-artifacts --no-verify-jwt

# ── Fase 5: Injeção silenciosa de contexto ──────────────────
echo ""
echo "▶ Fase 5 — query-copilot (system prompt dinâmico)"
npx supabase functions deploy query-copilot --no-verify-jwt

# ── Dependência compartilhada (exclusão na aba Documentos) ───
echo ""
echo "▶ Dependência — delete-saved-recommendation"
npx supabase functions deploy delete-saved-recommendation --no-verify-jwt

echo ""
echo "✅ Deploy Conversacional First concluído!"
echo ""
echo "Validações recomendadas:"
echo "  npm run typecheck"
echo "  npm run build"
echo "  npm run test:unit -- src/containers/patient/copilot/ src/containers/patient/documents/"
