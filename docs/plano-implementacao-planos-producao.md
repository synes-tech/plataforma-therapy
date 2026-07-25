# Plano de Implementação — Planos de Produção (Stripe + Supabase + Plataforma)

> Status: **APROVADO — decisões fechadas em 25/07/2026 (§2)**
> Regra de ouro: tudo é construído e validado primeiro em **ambiente de teste** (Stripe test mode + banco). Nada é executado em produção sem aprovação explícita.

---

## 1. Catálogo final de planos

### 1.1 Planos de assinatura

| Plano | Pacientes ativos | Mensal | Anual (12% off) | Anual total |
|---|---|---|---|---|
| **FREE** | 1 | R$ 0 | — | — |
| **STANDARD** | até 10 | R$ 231,20/mês | R$ 203,46/mês | R$ 2.441,47/ano |
| **ADVANCED** | até 20 | R$ 462,40/mês | R$ 406,91/mês | R$ 4.882,94/ano |
| **PREMIUM** | até 30 | R$ 693,60/mês | R$ 610,37/mês | R$ 7.324,42/ano |

### 1.2 Módulos Adicionais (upsell de pacientes)

| Módulo | Aplica-se a | Mensal | Anual (12% off) | Anual total |
|---|---|---|---|---|
| Módulo Adicional S/A | Standard e Advanced | R$ 129,43/mês | R$ 113,90/mês | R$ 1.366,78/ano |
| Módulo Adicional P | Premium | R$ 106,32/mês | R$ 93,56/mês | R$ 1.122,74/ano |

- Cada módulo adiciona **+5 pacientes** ao limite do plano (inferido do custo de tecnologia: R$ 57,80 = 5 × R$ 11,56/paciente — **confirmar em §2.1**).
- Módulo acompanha o ciclo do plano (mensal ou anual) e é um `subscription_item` adicional na mesma assinatura Stripe.

### 1.3 Limites por plano (cotas)

| Cota | FREE | STANDARD | ADVANCED | PREMIUM |
|---|---|---|---|---|
| Pacientes ativos | 1 | 10 (+5/módulo) | 20 (+5/módulo) | 30 (+5/módulo) |
| Sessões por paciente/mês (recomendado — soft) | 4 | 4 | 4 | 4 |
| Sessões totais/mês (limite real — hard) | 4 | 40 (+20/módulo) | 80 (+20/módulo) | 120 (+20/módulo) |
| Duração máx. da sessão | 50 min | 60 min | 60 min | 60 min |
| Áudios da família | Ilimitado | Ilimitado | Ilimitado | Ilimitado |
| Interações IA (chat copilot)/mês | 20 | 750 | 1.500 | 2.250 |

**Racional das interações de IA** (proposta minha — validar em §2.2): ~75 interações por slot de paciente/mês. Um terapeuta ativo usa o copilot ~2–3x por sessão (preparação + análise) → 4 sessões × 3 = 12/paciente; 75 dá folga de 6x sem risco de custo (cada interação custa centavos de LLM; 2.250 interações no Premium custam < R$ 40/mês de infra, dentro da verba de tecnologia). FREE = 20/mês, suficiente para experimentar sem virar canal de uso gratuito. Cada módulo adicional soma +375 interações. Avisos em 80% e 100%; ao estourar, modal de upgrade (não corta no meio de uma resposta).

### 1.4 Ciclo anual: 12x emulado com fidelidade (DECIDIDO)

A Stripe não suporta parcelamento nativo (12x) para assinaturas no Brasil. **Decisão: 12x emulado com trava de cartão + fidelidade contratual.**

Mecânica:

1. Plano anual = **12 cobranças mensais** com o preço anual com desconto (ex.: Standard R$ 203,46/mês) via **Subscription Schedule** com fase de 12 meses (`phases[duration]: month × 12`).
2. **Trava de cartão:** enquanto a assinatura anual estiver dentro dos 12 meses, a plataforma **não oferece** remoção do método de pagamento (o detach só é possível via nossa API — o cliente não tem acesso direto à Stripe). A **troca** de cartão permanece permitida (cartão expirado/substituído). Se usarmos Customer Portal, configurar sem opção de remoção.
3. **Cancelamento antecipado (obrigatório por CDC — não podemos impedir):** aplicar **quebra de fidelidade** — meses já usados são recalculados ao preço mensal cheio (perde o desconto de 12% retroativamente) e a diferença é cobrada como acerto final via invoice avulsa. Regra explícita nos Termos de Uso e no aviso pré-contratação.
4. **Inadimplência no meio do anual:** Smart Retries → `past_due` → e-mails de cobrança; se a Stripe esgotar as tentativas, downgrade para FREE (§1.7) + registro da pendência. Risco residual (cartão bloqueado no banco) é coberto por contrato, não por código.
5. UI deve comunicar com clareza: "Plano anual: compromisso de 12 meses, cobrado mensalmente em R$ X com 12% de desconto. Cancelamento antecipado implica perda do desconto sobre os meses utilizados."

### 1.5 Trial de 14 dias (com cartão)

- Todo usuário novo entra no **FREE** (1 paciente) automaticamente ao se registrar — sem cartão.
- Ao contratar qualquer plano pago pela primeira vez, ganha **14 dias grátis** (`trial_period_days=14` no Checkout da Stripe), com cartão cadastrado.
- Aviso obrigatório na tela do checkout: "Você não será cobrado hoje. A primeira cobrança ocorre em DD/MM/AAAA. Cancele a qualquer momento antes disso, sem custo" + passo a passo de como cancelar.
- Trial é concedido **uma única vez por clínica** (flag `trial_used` no banco) — evita abuso de recriação.
- Evento `customer.subscription.trial_will_end` (3 dias antes) dispara e-mail de aviso via SES.

### 1.6 Cancelamento e revogação (crítico — jurídico)

Botão **"Cancelar plano e revogar método de pagamento"** em Configurações → Plano, sempre visível (não escondido em submenu):

1. Cancela a assinatura na Stripe (`cancel_at_period_end=true` se ativa; cancelamento **imediato** se em trial).
2. **Desanexa todos os payment methods** do customer na Stripe (`paymentMethods.detach`) — garantia de que nenhuma cobrança futura é possível.
   - **Exceção — plano anual dentro dos 12 meses:** antes de cancelar, exibir e aplicar a quebra de fidelidade (§1.4): gerar invoice de acerto (diferença entre preço cheio e preço com desconto dos meses usados), cobrar, e só então cancelar e desanexar o cartão.
3. Registra em `audit_logs` (quem, quando, IP) — trilha para eventual disputa.
4. Downgrade para FREE na data efetiva (imediato no trial; fim do período pago se ativa — o cliente usa o que pagou).
5. E-mail de confirmação do cancelamento com data efetiva.
6. Fluxo com dupla confirmação (modal StandardModal), mas **sem dark patterns** — máximo 2 cliques.

### 1.7 Inadimplência e downgrade automático

- `invoice.payment_failed` → status `past_due`; Stripe Smart Retries tenta recobrar por até 2 semanas; banner na plataforma "Atualize seu pagamento".
- Durante `past_due`: plataforma continua funcional (grace period) para não punir falha transitória de cartão.
- `customer.subscription.deleted` (Stripe desiste das tentativas) → **downgrade automático para FREE**: `subscription_plan='free'`, limites resetados, pacientes acima do limite ficam **somente leitura** (nunca apagar dados clínicos — LGPD/ética).
- Rede de segurança: cron diário `sync-stripe-subscriptions` (já existe) reconcilia qualquer divergência Stripe ↔ banco.

---

## 2. Decisões fechadas (25/07/2026)

1. **Módulo adicional = +5 pacientes** por módulo (confirmado).
2. **Limites de IA aprovados:** FREE 20 · STANDARD 750 · ADVANCED 1.500 · PREMIUM 2.250 interações/mês (+375 por módulo). Aviso em 80%, bloqueio com modal de upgrade em 100%.
3. **Anual = 12x emulado com fidelidade** (§1.4): trava de remoção de cartão durante o compromisso + quebra de fidelidade (perda retroativa do desconto) em cancelamento antecipado.
4. **Sessões — semântica das cotas:**
   - **4 sessões/paciente/mês é RECOMENDAÇÃO, não bloqueio.** Ao criar a 5ª sessão de um paciente no mês, exibir aviso detalhado: "O limite recomendado de sessões para este paciente (4/mês) já foi atingido. Se realizar mais uma, poderá faltar para outros pacientes — seu limite total é de N sessões/mês no plano X (usadas: M)."
   - **O limite real (hard) é o TOTAL do plano** (Standard 40, Advanced 80, Premium 120, +20/módulo): atingido o total do mês, bloquear criação de novas sessões com modal de upgrade.
   - Duração: 60 min nos planos pagos, 50 min no FREE (confirmado).

---

## 3. Etapas de execução

Ordem de dependência do projeto: **DBA → Backend → Frontend → QA → Segurança**. Stripe test mode corre em paralelo com o DBA.

---

### ETAPA 1 — Banco de dados (Agente DBA)

**Entregável:** migration `2026XXXX_planos_producao_v2.sql` aplicada local e no remoto.

1. **Enum e catálogo**
   - Adicionar valores ao enum `subscription_plan`: `'free' | 'standard' | 'advanced' | 'premium'`.
   - Seed/upsert na tabela `planos`: 4 planos novos com `preco_mensal_cents`, novo campo `preco_anual_cents`, `limite_pacientes_por_prof` (1/10/20/30), `features`, `ativo=true`; desativar `inicial`/`intermediario` (manter para histórico).
   - Novas colunas em `planos`: `preco_anual_cents`, `stripe_price_id_test_anual`, `stripe_price_id_live_anual` (as mensais já existem).
2. **Módulos adicionais**
   - Tabela `plan_addons` (catálogo): `id`, `nome`, `pacientes_bonus` (5), `preco_mensal_cents`, `preco_anual_cents`, `planos_aplicaveis[]`, price IDs Stripe test/live (mensal+anual).
   - Tabela `clinic_addons`: `clinic_id`, `addon_id`, `quantidade`, `stripe_subscription_item_id`, `status`, timestamps. Substitui o modelo atual de `professionals.patient_quota_bonus` como fonte de verdade (bonus vira coluna derivada/sincronizada para compatibilidade).
3. **Billing e trial**
   - `clinics`: novas colunas `billing_cycle` (`monthly|yearly`), `trial_used boolean default false`, `downgraded_at timestamptz`, `commitment_ends_at timestamptz` (fim do compromisso anual — controla a trava de remoção de cartão e a quebra de fidelidade).
   - Migrar dados: clínicas em `inicial` → `standard`; `intermediario` → `advanced`; `trialing` sem cartão → `free` com `trial_used=false`.
4. **Cotas de sessões e IA**
   - Função SQL `check_session_quota(p_patient_id)` → sessões do paciente no mês corrente vs limite 4; e `get_clinic_session_usage(p_clinic_id)` → total usado vs limite do plano.
   - Tabela `ai_usage_events` (`clinic_id`, `user_id`, `feature`, `created_at`) — 1 linha por interação de copilot; índice por `clinic_id + created_at`. Função `check_ai_interaction_quota(p_clinic_id)`.
   - Atualizar `sync_clinic_settings_from_plano` para os novos planos e novas cotas (`max_ai_queries_per_month` por plano, duração de sessão).
5. **Deploy remoto validado** (regra do Agente DBA §8) — `npx supabase db push` + smoke query.

---

### ETAPA 2 — Stripe test mode (catálogo + webhook)

**Entregável:** script idempotente `scripts/setup-stripe-catalog.mjs` + catálogo criado no test mode + price IDs gravados no banco.

1. Script cria (ou reutiliza, via `lookup_key`) no **test mode**:
   - Produtos: `PLANO STANDARD`, `PLANO ADVANCED`, `PLANO PREMIUM`, `MÓDULO ADICIONAL S/A`, `MÓDULO ADICIONAL P` — com `metadata.plan_id`, `metadata.patient_limit`.
   - Prices BRL, ambos `interval=month`: **mensal** (preço cheio) e **anual-12x** (preço com 12% off, usado só dentro do Subscription Schedule de 12 meses — §1.4). `lookup_key` padrão `plano_{id}_{mensal|anual}` / `addon_{id}_{mensal|anual}`.
   - Valores mensais em centavos — standard: 23120 / 20346; advanced: 46240 / 40691; premium: 69360 / 61037; módulo S/A: 12943 / 11390; módulo P: 10632 / 9356.
2. Script grava os price IDs de volta em `planos.stripe_price_id_test*` e `plan_addons` (via service role).
3. Registrar webhook endpoint test mode → `https://<projeto>.functions.supabase.co/stripe-webhook`, eventos: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.trial_will_end`, `invoice.payment_failed`, `invoice.paid`. Gravar `whsec_` em `STRIPE_BILLING_WEBHOOK_SECRET_TEST`.
4. Configurar **Customer Portal** (test) como fallback de gestão: permitir cancelamento e troca de cartão, desabilitar troca de plano (a troca é pela plataforma).
5. `STRIPE_BILLING_MODE=test` nos secrets do Supabase durante toda a fase de testes.

---

### ETAPA 3 — Backend / Edge Functions (Agente Backend)

**Entregável:** funções deployadas e testadas contra o Stripe test mode.

1. **`create-stripe-checkout` v2**
   - Aceitar `billing_cycle` (`monthly|yearly`) e `addon_quantity` (módulos).
   - Se `trial_used=false`: `subscription_data.trial_period_days=14` + `payment_method_collection='always'`; marcar `trial_used=true` no provisionamento.
   - Montar `line_items` com price do plano + price do módulo × quantidade (mesmo ciclo).
   - **Anual (12x emulado):** após o checkout, converter a assinatura em **Subscription Schedule** com fase de 12 meses (`phases[duration]: month × 12`, `end_behavior=release` renovando ou notificando ao fim). Gravar `billing_cycle='yearly'` e `commitment_ends_at` na clínica.
   - Preços anuais no Stripe: criados como prices **mensais** com o valor com desconto (ex.: `plano_standard_anual` = R$ 203,46 `interval=month`), usados exclusivamente dentro do schedule de 12 meses.
2. **`stripe-webhook` v2**
   - `customer.subscription.deleted` → **downgrade para FREE** (novo helper `downgradeClinicToFree` em `_shared/stripe-billing-provision.ts`): plano, status, cotas, e-mail de aviso.
   - `customer.subscription.trial_will_end` → e-mail SES "seu trial termina em 3 dias, será cobrado R$ X em DD/MM".
   - `invoice.payment_failed` → `past_due` + e-mail.
   - `customer.subscription.updated` → sincronizar plano/ciclo/módulos (ler `subscription_items`).
3. **Nova função `cancel-subscription`** (a peça jurídica)
   - Auth do dono da clínica; cancela na Stripe (imediato se trial, `cancel_at_period_end` se ativa); **detach de todos os payment methods**; atualiza banco; grava `audit_logs`; envia e-mail de confirmação. Idempotente e com retry — se a Stripe falhar, retorna erro claro e NÃO marca como cancelado no banco.
4. **Módulos adicionais reais** — substituir o bypass de `purchase-patient-quota-pack`: nova compra adiciona `subscription_item` na assinatura existente (cobrança proporcional automática pela Stripe) e insere em `clinic_addons`.
5. **Enforcement de cotas**
   - `create-session` (ou equivalente): chamar `check_session_quota` — a 5ª sessão do paciente no mês retorna **warning estruturado** (frontend exibe o aviso detalhado do §2.4 e permite prosseguir); sessão além do **total do plano** retorna **bloqueio** (modal de upgrade).
   - `query-copilot` e afins: inserir em `ai_usage_events` + checar `check_ai_interaction_quota` antes de responder.
   - Duração de sessão: validar 50/60 min conforme plano na criação/edição da sessão.
   - Áudio da família: sem cota (explícito no código).
6. **`get-plan-control-state` v2** — retornar consumo completo: pacientes (usado/limite), sessões do mês (por paciente e total), interações IA (usado/limite), módulos ativos, ciclo, próxima cobrança (data+valor via Stripe), status do trial.
7. Deploy remoto de todas as funções alteradas (regra do projeto — nunca terminar só avisando "precisa deployar").

---

### ETAPA 4 — Frontend (Agente Frontend)

**Entregável:** UI unificada — uma única fonte de verdade de planos para Settings, Paywall, Registro e Landing.

1. **Fonte única:** refatorar `src/shared/lib/therapist-plans.ts` + `plan-quota-limits.ts` para os 4 planos novos; preços vêm do banco (`planos`) via API — nada de valor hardcoded em componente. Landing (`landing-content.ts`) passa a importar do mesmo módulo compartilhado.
2. **Configurações → Plano (`SettingsPlanTab` / `PlanControlContainer`):**
   - Cards dos 4 planos com toggle Mensal/Anual, plano atual destacado, upgrade/downgrade self-service.
   - **Painel de consumo**: barras de progresso para pacientes, sessões do mês (total + por paciente expandível), interações IA — com cores de alerta em 80%/100% (dados do `get-plan-control-state` v2).
   - Módulos adicionais: comprar/remover com preço e ciclo corretos.
   - Botão **"Cancelar plano e revogar método de pagamento"** — visível na própria aba, estilo destrutivo claro, fluxo em `StandardModal` com dupla confirmação + explicação do que acontece (data efetiva, downgrade para FREE, dados preservados).
3. **PaywallModal v2:** disparado ao estourar qualquer cota (2º paciente no FREE, 5ª sessão do paciente, limite de IA) — mostra os 4 planos com valores, destaca o recomendado, CTA para checkout.
4. **Fluxo de trial no checkout:** tela pré-Stripe com o aviso legal ("não será cobrado hoje; primeira cobrança em DD/MM; como cancelar em 2 passos") + link para a política. `CheckoutReturnContainer` reconhece retorno de trial (`status=trialing`).
5. **Landing page:** seção de planos com os 4 planos e valores reais, toggle mensal/anual funcional, FAQ atualizado ("14 dias grátis em qualquer plano pago, com cartão; cancele quando quiser").
6. **Registro:** usuário novo cai no FREE direto (sem seleção de plano no cadastro); primeira tentativa de 2º paciente abre o paywall.

---

### ETAPA 5 — QA (test mode, ponta a ponta)

**Entregável:** roteiro executado + `scripts/qa-stripe-billing.mjs` estendido. Cartões de teste Stripe (`4242…` sucesso, `4000…0341` falha pós-trial).

| # | Cenário | Resultado esperado |
|---|---|---|
| 1 | Registro novo | FREE, 1 paciente, `trial_used=false` |
| 2 | 2º paciente no FREE | Paywall com 4 planos |
| 3 | Assinar STANDARD mensal (1ª vez) | Trial 14d, R$ 0 cobrado, status `trial_active`, limites 10 pacientes |
| 4 | Cancelar durante o trial | Cancelamento imediato, cartão desanexado, volta a FREE, e-mail enviado |
| 5 | Trial termina com cartão válido | Cobrança R$ 231,20, status `active` |
| 6 | Trial termina com cartão que falha | `past_due` → retries → `subscription.deleted` → **FREE automático** |
| 7 | Upgrade STANDARD→PREMIUM | Proration correta, limites 30 |
| 8 | Assinar anual (12x emulado) | Schedule de 12 meses criado, 1ª cobrança R$ 203,46, `commitment_ends_at` correto, UI sem opção de remover cartão |
| 8b | Cancelar anual no mês 3 | Invoice de quebra de fidelidade (3 × diferença de 12%), depois cancela + detach |
| 9 | Comprar módulo adicional | +5 pacientes, item na assinatura, cobrança proporcional |
| 10 | 5ª sessão do paciente no mês | Aviso detalhado (soft), permite prosseguir |
| 10b | Sessão além do total do plano (ex.: 41ª no Standard) | Bloqueio + modal upgrade |
| 11 | Estourar interações IA | Aviso 80%, bloqueio 100% |
| 12 | 2ª tentativa de trial (nova assinatura após cancelar) | **Sem** trial — cobra imediato |
| 13 | Cron `sync-stripe-subscriptions` | Reconcilia divergência simulada |
| 14 | Downgrade com pacientes acima do limite | Excedentes em somente leitura, nada apagado |

Segurança (Agente Segurança): validar assinatura do webhook, idempotência, RLS nas tabelas novas, audit trail do cancelamento, nenhuma chave secreta no frontend.

---

### ETAPA 6 — Produção (SOMENTE após aprovação explícita)

> **Gate: perguntar ao usuário antes de qualquer passo desta etapa. Ele testará pessoalmente.**

1. Rodar `setup-stripe-catalog.mjs` no **live mode** (cria os produtos/prices reais; arquivar `PLANO INICIAL`, `PLANO INTERMEDIARIO`, `TESTE 1 REAL`).
2. Registrar webhook live + `STRIPE_BILLING_WEBHOOK_SECRET` live nos secrets.
3. Gravar price IDs live no banco (`stripe_price_id_live*`).
4. Configurar Customer Portal live.
5. Virar `STRIPE_BILLING_MODE=live` nos secrets do Supabase.
6. Smoke test real com valor baixo (recriar um price de R$ 1 se necessário) + cancelamento/refund.
7. Migração de assinantes live existentes (se houver) para os planos novos — mapear caso a caso.
8. Monitorar primeiros dias: Dashboard Stripe (webhook delivery), logs das Edge Functions, cron diário.

---

## 4. Resumo de artefatos novos/alterados

| Camada | Artefatos |
|---|---|
| Banco | migration v2 (enum, `planos`, `plan_addons`, `clinic_addons`, `ai_usage_events`, funções de cota, migração de dados) |
| Scripts | `setup-stripe-catalog.mjs` (idempotente, test/live), `qa-stripe-billing.mjs` estendido |
| Edge Functions | `create-stripe-checkout` v2, `stripe-webhook` v2, **`cancel-subscription` (nova)**, `purchase-patient-quota-pack` v2 (Stripe real), `get-plan-control-state` v2, guards em `create-session`/`query-copilot` |
| Frontend | `therapist-plans.ts` v2, `SettingsPlanTab`/`PlanControlContainer` v2 (consumo + cancelar), `PaywallModal` v2, checkout trial, `landing-content.ts` unificado |
| Stripe | 5 produtos × 2 prices (mensal/anual), webhook test+live, Customer Portal |
