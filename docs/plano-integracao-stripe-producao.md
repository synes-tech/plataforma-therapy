# Plano de implementação — Stripe produção (substituir checkout-bypass)

> **Missão:** Unir o laboratório Stripe (`/unithery/teste`) ao fluxo real da plataforma (Paywall → Checkout → Webhook → Cotas).
>
> **Referência:** [visao-stripe-laboratorio-e-assinaturas.md](./visao-stripe-laboratorio-e-assinaturas.md)
>
> **Status:** Em execução — Fase 1 e 2 iniciadas neste branch.

---

## Princípios inegociáveis

| Regra | Detalhe |
|-------|---------|
| UI | Somente `src/containers/` — `pages/` proibido |
| Fonte financeira | Stripe (`price_id`, status assinatura) |
| Fonte de permissões | PostgreSQL (`clinics`, `clinic_settings`, `planos`) |
| Atualização primária | Webhooks Stripe (tempo real) |
| Rede de segurança | Cron diário 03:00 (reconciliação) |
| Laboratório | `/unithery/teste` permanece isolado até desativar manualmente |

---

## Visão alvo (fluxo unificado)

```mermaid
flowchart TD
  A[Usuário bloqueado no Paywall] --> B[Escolhe plano]
  B --> C[POST create-stripe-checkout]
  C --> D[Redirect Stripe Checkout]
  D --> E{Pagamento}
  E -->|OK| F[Webhook checkout.session.completed]
  E -->|Cancel| G[/checkout/return?canceled=1]
  F --> H[Atualiza clinics + clinic_settings]
  H --> I[/checkout/return?success=1]
  I --> J[Polling status até active]
  J --> K[Acesso liberado]
  L[Cron 03:00 sync-stripe-subscriptions] --> M[Cruza Stripe vs DB]
  M --> H
```

---

## Fase 1 — DBA (modelagem + cron)

### Entregas

| # | Entrega | Arquivo | Status |
|---|---------|---------|--------|
| 1.1 | Colunas `stripe_customer_id`, `stripe_subscription_id` em `clinics` | `20260717200000_stripe_billing_integration.sql` | ✅ |
| 1.2 | Colunas `stripe_price_id_test`, `stripe_price_id_live` em `planos` | mesma migration | ✅ |
| 1.3 | Seed price_ids alinhados (inicial/intermediario + clínica quando existir) | mesma migration | ✅ |
| 1.4 | Índices + comentários | mesma migration | ✅ |
| 1.5 | Função `invoke_sync_stripe_subscriptions()` + pg_cron 03:00 BRT | mesma migration | ✅ |
| 1.6 | Deploy migration remoto | `supabase db query --linked` | ✅ |

### Critérios de aceite (Gate Fase 1)

- [ ] Migration aplicada sem erro no projeto linked
- [ ] `SELECT stripe_customer_id FROM clinics LIMIT 1` funciona
- [ ] `planos.stripe_price_id_test` preenchido para `inicial` e `intermediario`
- [ ] Job cron visível em `cron.job` com nome `sync_stripe_subscriptions_daily`

---

## Fase 2 — Backend (checkout, webhook, sync)

### Entregas

| # | Entrega | Arquivo | Status |
|---|---------|---------|--------|
| 2.1 | Módulo compartilhado de provisionamento | `_shared/stripe-billing-provision.ts` | ✅ |
| 2.2 | Resolução price_id via `planos` + modo test/live | `_shared/stripe-billing-config.ts` | ✅ |
| 2.3 | **`create-stripe-checkout`** (auth, metadata clinic_id) | `create-stripe-checkout/*` | ✅ |
| 2.4 | **`stripe-webhook`** (assinatura obrigatória) | `stripe-webhook/*` | ✅ |
| 2.5 | Eventos: `checkout.session.completed`, `customer.subscription.updated/deleted`, `invoice.payment_failed` | webhook service | ✅ |
| 2.6 | **`sync-stripe-subscriptions`** (CRON_SECRET) | `sync-stripe-subscriptions/*` | ✅ |
| 2.7 | Deprecar `process-checkout-bypass` (manter até flag desligada) | — | 🟡 |
| 2.8 | Deploy functions | CLI | ✅ |
| 2.9 | Secret `STRIPE_BILLING_WEBHOOK_SECRET` + `STRIPE_BILLING_ENABLED=true` | Supabase secrets | ✅ |

### Mapeamento status Stripe → `clinics.subscription_status`

| Stripe `subscription.status` | DB `subscription_status` | Paywall |
|-------------------------------|--------------------------|---------|
| `active` | `active` | Liberado |
| `trialing` | `trial_active` | Liberado |
| `past_due` | `past_due` | Bloqueado |
| `canceled`, `unpaid`, `incomplete_expired` | `canceled` | Bloqueado |

### Critérios de aceite (Gate Fase 2)

- [ ] `create-stripe-checkout` retorna URL válida (test mode)
- [ ] Webhook rejeita payload sem assinatura válida (400)
- [ ] Webhook `checkout.session.completed` atualiza clínica em < 2s
- [ ] `sync-stripe-subscriptions` corrige divergência simulada
- [ ] `audit_logs` registra eventos billing

---

## Fase 3 — Frontend (Paywall + retorno)

### Entregas

| # | Entrega | Arquivo | Status |
|---|---------|---------|--------|
| 3.1 | Paywall: botão plano → `create-stripe-checkout` → redirect | `PaywallProvider.tsx`, `PaywallModal.tsx` | ✅ |
| 3.2 | Remover formulário fake de cartão do paywall | `PaywallModal.tsx` (fallback se flag off) | 🟡 |
| 3.3 | Tela retorno `/checkout/return` com polling | `CheckoutReturnContainer.tsx` | ✅ |
| 3.4 | Rota pública autenticada | `routes.tsx` | ✅ |
| 3.5 | Loading animado + mensagens sucesso/cancelamento | containers | ✅ |
| 3.6 | Invalidar `paywall-state` após confirmação | TanStack Query | ✅ |

### Critérios de aceite (Gate Fase 3)

- [ ] Fluxo completo sem tocar em `process-checkout-bypass`
- [ ] Usuário vê loading até webhook provisionar (max ~15s polling)
- [ ] Cancelamento volta ao dashboard sem erro

---

## Fase 4 — QA + Segurança

### Cenários obrigatórios

| # | Cenário | Como validar |
|---|---------|--------------|
| 4.1 | Assinar Inicial (cartão 4242…) | Paywall → Stripe → return → paciente 2 liberado | ✅ (API) |
| 4.2 | Webhook atualizou DB | `clinics.stripe_subscription_id` preenchido | ✅ |
| 4.3 | Cancelar no Dashboard Stripe | Status → canceled | ✅ |
| 4.4 | Rodar sync manual | POST `sync-stripe-subscriptions` → paywall bloqueia | ✅ |
| 4.5 | Webhook spoofing | POST sem signature → 400 | ✅ |
| 4.6 | IDOR checkout | clinic_id de outra clínica no metadata → ignorado | 🟡 |

### Gate final

- [ ] QA aprova checklist
- [ ] Segurança revisa webhook + cron secret
- [ ] `process-checkout-bypass` desativado em produção (`STRIPE_BILLING_ENABLED=true`)

---

## Secrets necessários (Supabase)

```bash
STRIPE_BILLING_ENABLED=true
STRIPE_BILLING_MODE=test          # ou live em produção
STRIPE_BILLING_WEBHOOK_SECRET=whsec_...
STRIPE_TEST_SECRET_KEY=sk_test_...
STRIPE_LIVE_SECRET_KEY=sk_live_...
STRIPE_APP_ORIGIN=https://app.unithery.com.br
CRON_SECRET=...                   # já usado por outros crons
```

---

## Ordem de execução (dependências)

```
Fase 1 (DBA)
    ↓
Fase 2.1–2.6 (Backend core)
    ↓
Fase 2.8 Deploy + configurar webhook URL no Stripe Dashboard
    ↓
Fase 3 (Frontend)
    ↓
Fase 4 (QA)
    ↓
Desligar bypass
```

---

## Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Webhook perdido | Cron diário sync |
| Preço DB ≠ Stripe | Colunas `stripe_price_id_*` na tabela `planos` |
| Enum PG novo valor | Usar valores existentes (`past_due`, `canceled`) |
| Laboratório vs produção | Functions separadas: `stripe-test-*` vs `stripe-billing-*` |

---

## Log de progresso

| Data | Fase | Notas |
|------|------|-------|
| 2026-07-16 | Plano | Documento criado |
| 2026-07-16 | 1–3 | Migration aplicada, backend deployado, frontend conectado |
| 2026-07-16 | 4 | QA automatizado 8/8 — secrets, webhook Stripe, vault cron |

---

*Documento vivo — atualizar a coluna Status conforme entregas.*
