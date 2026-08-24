# Plano Mestre — Unithery de Duas Pontas (B2B + B2C)

> **Status:** contrato de execução aprovado no Prompt 1.
> **Autor:** Agente Orquestrador (CTO) — consolidando Frontend, Backend, DBA, IA, QA e Segurança.
> **Data:** 22/08/2026
> **Regra de uso:** este documento é a fonte de verdade para os Prompts 2 a 10. Quando o texto de um
> prompt do usuário divergir daqui, **prevalece este documento** (autonomia concedida no Prompt 1),
> exceto onde o usuário responder explicitamente o contrário.

---

## 1. Sumário executivo

A Unithery deixa de ser "plataforma para terapeutas infantis TEA/TDAH" e passa a ser
**plataforma clínica universal para psicólogos**, com o ecossistema infantil/neurodivergente
preservado e **promovido a módulo especializado** (diferencial competitivo, não mais o escopo).

Duas pontas:

| Ponta | Quem paga | O que recebe |
|---|---|---|
| **B2B** (existente) | Terapeuta / clínica | Prontuário, agenda, financeiro, Copiloto Clínico RAG |
| **B2C Free** (novo) | Ninguém (custeado pelo B2B) | Portal do Paciente: check-in diário (texto/áudio), resumos liberados, plano de cuidados |
| **B2C Premium** (novo) | O próprio paciente | Acompanhante de Apoio 24/7 (chat IA empático, áudio, coping) |

E dois modos de portal, no **mesmo PWA**:

- **CAREGIVER** — responsável relata sobre a criança (fluxo atual, preservado)
- **SELF** — paciente adulto/adolescente relata sobre si mesmo (novo)

---

## 2. Estado real da plataforma (verificado em 22/08/2026, não inferido)

Tudo abaixo foi confirmado por inspeção direta do Cloud SQL de produção, da API Cloud Run,
do Stripe live e da Vertex AI.

### 2.1 Infraestrutura

| Item | Valor real |
|---|---|
| Projeto GCP | `plataforma-therapy-ai` / `us-central1` |
| API | Cloud Run `unithery-api-staging` (nome enganoso: **é produção**), `/health` → `handlers: 115` |
| Runtime | Deno único + **PostgREST no mesmo container** (porta 3001) |
| Código das rotas | `supabase/functions/*/index.ts` — **fonte de verdade viva**, carregada no boot por `cloud-run/api/main.ts` |
| Banco | Cloud SQL `unithery-pg-staging`, **PostgreSQL 17.10**, **`db-f1-micro`**, pgvector 0.8.1 |
| Frontend | GCS `unithery-fe-staging` + Cloud CDN → `unithery.com` |
| Auth | Identity Platform (Firebase), claims `role` / `clinic_id` / `is_solo` |
| E-mail | AWS SES `us-east-1`, remetente `contact@unithery.com` |
| Stripe | modo **live** ligado (`STRIPE_BILLING_MODE=live`), catálogo v2 com 5 produtos ativos |
| Vertex AI | `gemini-2.5-pro` (chat), `gemini-embedding-001` 768d (RAG), STT = Gemini multimodal |

**Supabase é legado de rollback.** O `DATABASE_URL` do `.env` local ainda aponta para o Supabase
antigo — **nunca usar esse valor** para migrations desta epopeia.

### 2.2 Banco de dados — 43 tabelas, RLS em 42

Volumetria real (produção):

| Tabela | Linhas |
|---|---|
| `clinics` | 17 |
| `professionals` | 16 |
| `patients` | 38 |
| `family_members` | 13 |
| `patient_family_links` | 12 |
| `diary_entries` | 19 |
| `session_notes` | 25 |
| `therapist_schedule` | 209 |
| `patient_embeddings` | 92 |
| `copilot_messages` | 0 (feature recente) |
| `crisis_alerts` | 11 |

### 2.3 Achados que mudam o desenho (dados reais, não hipóteses)

**A) A plataforma JÁ atende adultos — sem suporte de produto.**

Distribuição etária dos 30 pacientes ativos:

```
CHILD(<13):        19
ADOLESCENT(13-17):  6
ADULT(18+):         5
```

**37% dos pacientes ativos não são crianças.** Terapeutas já estão forçando pacientes
adultos num formulário que pergunta "hiperfocos" e "dinâmica familiar". A migração não é
especulativa — é correção de um problema em produção.

**B) O campo `diagnoses` é lixo não normalizado.** Amostra real:

```
TDAH (13) | TEA (5) | Ansiedade (2) | TAG (2) | TPAC (2) | TOC (1) | ANSIEDADE (1)
TEA - Nível 1 (1) | TEA - NIVEL 1 (1) | TEA Nivel 1 (1) | ANSIEDADE GENERALZIADA (1)
Transtorno do processamento auditivo central (1) | TPAC (2) | "a" (1)
```

Quatro grafias para "TEA nível 1", "TPAC" e o nome por extenso como entradas distintas,
um registro com o valor `"a"`. Isso **envenena o RAG** (o system prompt injeta `diagnoses`
literalmente) e impossibilita qualquer segmentação de produto por condição.

**C) Não existe o que o plano assume que existe:**

| Plano original assume | Realidade |
|---|---|
| RPC `check_patient_quota` | Não existe. É `assertCanAddPatient` (`_shared/plan-quotas.ts`) + `assertCanCreatePatientPaywall` |
| `create-patient` cria o convite | Não cria. Convite é fluxo separado (`generate-invite`) |
| `create-patient` roda em transação | Não roda. É insert + compensação por soft-delete |
| `SET LOCAL request.jwt.claims` nas functions | Não é assim. Functions usam service client com `BYPASSRLS`; authZ é na aplicação |
| Tabela `sessions` | Não existe. É `therapist_schedule` + `session_notes` |
| Portal família tem "slider de agitação" | Agitação é **chip**, não slider. Slider é só a intensidade de crise (1-5) |

**D) `unithery_app` tem `BYPASSRLS`.** Toda a segurança das Edge Functions é de aplicação.
O RLS só protege o caminho `/rest/v1` (PostgREST com JWT de usuário). Isso é aceitável hoje
(B2B, usuários conhecidos), mas **muda de patamar de risco** quando abrirmos chat de IA para
pacientes finais.

**E) Segredos em texto claro nas variáveis de ambiente do Cloud Run:** senha do Postgres,
`PGRST_JWT_SECRET`, service account JSON completa (com chave privada) em base64,
`SUPABASE_SERVICE_ROLE_KEY` e `CRON_SECRET`. Só AWS e Stripe usam Secret Manager.

**F) `db-f1-micro`.** 1 vCPU compartilhada. Não sustenta chat B2C com streaming.

**G) Webhook Stripe sem idempotência por `event.id`.** Aceitável no volume B2B atual
(17 clínicas); vira incidente com B2C de alto volume.

---

## 2.4 Decisões travadas pelo product owner (22/08/2026)

Respostas dadas no Prompt 1. **Vinculantes** — não questionar de novo nos Prompts 2 a 10.

| # | Tema | Decisão |
|---|---|---|
| D1 | Ambiente | **Executar direto em produção**, com backup on-demand antes de cada migration e mudanças exclusivamente aditivas/idempotentes |
| D2 | Retroalimentação clínica | **Resumos consentidos + alertas de risco.** Paciente vê o que é compartilhado e pode desligar o resumo; **alerta de risco nunca é desativável** |
| D3 | Módulo neurodesenvolvimento | **Incluso em todos os planos**, ativado por paciente. É diferencial de marketing, **não paywall** |
| D4 | Preço B2C | **R$ 49,90/mês, criado direto no Stripe LIVE**, com **7 dias grátis exigindo cartão** (`trial_period_days: 7` + `payment_method_collection: always`) |
| D5 | Gestão da assinatura B2C | Tela dedicada no portal: dias restantes do trial, aviso explícito de que a cobrança será feita no cartão, e cancelamento self-service |
| D6 | Aviso de fim de trial | **E-mail SES 1 dia antes** do fim do período grátis, com design personalizado |
| D7 | Adolescente 13-17 | Acesso `SELF` **mediante consentimento registrado do responsável**, que mantém `CAREGIVER` paralelo. **Premium só 18+** |
| D8 | Rota do PWA | Migrar para `/portal/*`, mantendo `/family/*` como **redirect permanente** e o service worker tratando as duas rotas |
| D9 | Infraestrutura | **Manter `db-f1-micro` por enquanto.** Risco aceito conscientemente — ver plano de contingência em ADR-09 |
| D10 | Marca do Acompanhante | **"Thery"** |

### D4/D6 — nota técnica sobre o aviso de trial

O Stripe emite `customer.subscription.trial_will_end` **3 dias** antes do fim do trial, não 1 —
e esse intervalo não é configurável. Num trial de 7 dias, o evento cai no 4º dia. Para cumprir
o "1 dia antes" pedido, a implementação será:

1. Persistir `trial_end` em `patient_subscriptions` no `checkout.session.completed`.
2. **Cloud Scheduler** dispara um job diário que varre assinaturas com `trial_end` nas próximas
   24h e enfileira o e-mail (mesmo padrão já usado por `session_email_jobs` +
   `process-session-email-queue`), com marca de idempotência para não enviar duas vezes.
3. O evento nativo `trial_will_end` (3 dias antes) é aproveitado como um segundo toque, mais
   suave, opcional.

O e-mail sai pelo SES com template próprio em `_shared/billing-email-templates.ts`, seguindo a
identidade visual (serif no título, `#1A86E2` no CTA, superfície branca).

### D9 — plano de contingência do `db-f1-micro`

Risco aceito, mas não ignorado. Mitigações obrigatórias na implementação do chat:

- Teto de conexões do pool do PostgREST e do classificador, para o chat não esgotar o banco e
  derrubar o B2B junto.
- Rate limit por assinante nas rotas do Acompanhante (`rate_limits` já existe).
- Índices desenhados para que o feed de alertas e o histórico do chat não façam seq scan.
- Mensagens do chat não fazem join pesado no caminho quente.
- Alerta de latência: se o p95 do chat passar de 3s ou a CPU do Cloud SQL passar de 70%
  sustentado, o upgrade vira bloqueador e eu aviso.

---

## 3. Decisões arquiteturais (ADRs)

Onde eu divirjo do plano original, a divergência está marcada e justificada.

### ADR-01 — `patient_family_links` NÃO será renomeada fisicamente
**Plano original:** renomear para `patient_portal_links`.
**Decisão:** manter o nome físico; adicionar `access_level`; criar a **view** `patient_portal_links`
para o código novo.
**Motivo:** 12 vínculos vivos, 4 policies na própria tabela e 6 policies de outras tabelas
(`agreements`, `session_notes`, `recomendacoes_salvas`) fazem subquery nela, além de ~30 Edge
Functions. Renomear em produção para ganhar estética é risco sem retorno. A semântica "portal"
vem pela view e pelo código; a física migra depois, se algum dia valer a pena.

### ADR-02 — NÃO criar a role `portal_user`; o portal continua com `role='family'`
**Plano original:** custom claim `role = 'portal_user'`.
**Decisão:** manter `role='family'` como o papel de segurança do portal e introduzir
**`access_level` (`CAREGIVER` | `SELF`)** como a dimensão que muda a experiência.
**Motivo:** `role` é o eixo de autorização de 115 handlers, do `ProtectedRoute` e de ~40 policies
RLS, e está gravado como custom claim nos usuários existentes. Trocar o valor exigiria reescrever
tudo isso e re-emitir claims — risco enorme, ganho zero. O que muda para um adulto autônomo não é
o *nível de acesso* (continua sendo "1 usuário → 1 paciente"), é a *experiência*.
Mitigação de semântica: constante `PORTAL_ROLE` no código, e a UI **nunca** escreve "família"
para quem é `SELF`. Adiciono `patient` ao enum `user_role` como valor reservado, sem emitir.

### ADR-03 — Taxonomia clínica normalizada, com dual-write
Criar `clinical_taxonomy` (catálogo curado: código, rótulo, sinônimos, grupo, CID-11/DSM-5-TR
quando aplicável, faixa etária típica, módulo sugerido) e `patient_conditions` (M:N com
`is_primary`, `status`, `noted_at`).
`patients.diagnoses` **continua existindo e sincronizado** por trigger/dual-write, porque o
system prompt do copiloto, a UI de chips e os relatórios dependem dele. Migração de dados
com mapeamento determinístico dos 20 valores atuais + flag `needs_review` para o que não casar.
**Nunca** apagar dado clínico existente.

### ADR-04 — Módulos clínicos: o TEA vira módulo destacado, não default
```
CLINICO_GERAL              → sempre ativo, base universal (todo psicólogo)
NEURODESENVOLVIMENTO       → módulo especializado TEA/TDAH: portal família, hiperfocos,
                             registro sensorial, combinados, calendário de crises
```
Reservados para o futuro (criados no enum, sem UI): `PERINATAL`, `LUTO`, `DEPENDENCIA_QUIMICA`.
**O módulo especializado é incluso em todos os planos (D3)** — ativado por paciente, sem
paywall. Ele é o diferencial de posicionamento ("plataforma para todo psicólogo, com módulo
especializado em neurodesenvolvimento"), não uma trava comercial.
**Migração legada:** todos os 38 pacientes atuais recebem
`active_modules = {CLINICO_GERAL, NEURODESENVOLVIMENTO}` — porque a base histórica é infantil e
não podemos remover capacidade de ninguém. `profile_type` é derivado da `birth_date` real
(19 CHILD / 6 ADOLESCENT / 5 ADULT), não chutado como `CHILD` para todos.
**Divergência do plano original**, que mandava default `CHILD` para todos: isso classificaria
errado 11 pacientes reais.

### ADR-05 — Detecção de risco em 3 camadas, NUNCA só o JSON do LLM
**Plano original:** a Vertex retorna JSON com `risk_level` junto da resposta.
**Problema técnico:** isso é incompatível com streaming. Se o modelo tem que emitir um envelope
JSON, ou você perde o streaming (paciente em crise esperando 8s por um bloco de texto), ou você
faz streaming de JSON e a UI fica quebrada. E, pior: se o modelo falhar/timeout, você perde
**a detecção de risco** — o componente que não pode falhar.

**Decisão — defesa em profundidade:**

```
Camada 0  PRÉ-LLM, determinística, ~1ms
          Léxico PT-BR de ideação/automutilação/violência (inclui gíria e grafia evasiva).
          Nunca bloqueia sozinha; eleva o turno para "suspeito" e força a Camada 1.

Camada 1  CLASSIFICADOR DEDICADO, paralelo ao streaming
          Chamada separada gemini-2.5-flash com responseSchema estrito
          { risk_level, rationale, signals[] }. Roda AO MESMO TEMPO que o stream da resposta.
          Latência escondida atrás do streaming.

Camada 2  RESPOSTA EMPÁTICA, em streaming
          System prompt B2C. Se a Camada 0 OU a Camada 1 devolver SEVERE, o backend
          interrompe/complementa o stream com o bloco de emergência determinístico
          (CVV 188, SAMU 192, CAPS) — texto FIXO, não gerado por LLM.

Camada 3  SAFETY SETTINGS da Vertex + guardrail de output
          (reaproveitando query-copilot/guardrails.ts: sem medicação, sem diagnóstico)
```

O texto de emergência **não pode ser gerado pelo modelo**. É constante versionada no código,
revisada por humano. Um LLM alucinar um número de telefone de emergência é inaceitável.

### ADR-06 — Retroalimentação clínica: resumo consentido, não vetorização do chat cru
**Plano original:** vetorizar `patient_copilot_messages` em `patient_embeddings` para o RAG do
terapeuta.
**Problema:** o valor do Acompanhante para o paciente é ser um espaço seguro. Se tudo que ele
digitar às 3h da manhã for recuperável pelo copiloto do terapeuta, (a) o produto perde a razão
de existir no momento em que o paciente descobrir, e (b) tratamos dado de saúde sensível
(LGPD art. 11) sem base legal clara e sem finalidade específica informada.

**Decisão:**
1. O chat cru vive em `patient_copilot_messages`, **isolado**, e **não** é vetorizado.
2. Um job gera **resumos clínicos consentidos** (semanal + sob evento), em terceira pessoa,
   sem transcrição literal. Só o resumo vai para `patient_embeddings` com
   `document_type='companion_summary'`.
3. O paciente vê, no onboarding do premium e nas configurações, exatamente o que o terapeuta
   recebe, com toggle. **Alertas de risco SEVERE são exceção não-desativável** (dever de cuidado),
   e isso é dito com todas as letras antes da assinatura.
4. Se o paciente desliga o compartilhamento, o terapeuta continua vendo que houve atividade e
   os alertas de risco — nunca o conteúdo.

Isso preserva 100% da "mágica" prometida ("o paciente relatou taquicardia no trânsito na terça")
com base ética e jurídica defensável.

### ADR-07 — `gemini-2.5-flash` como motor padrão do B2C
`gemini-2.5-pro` a R$ 49,90/mês com uso 24/7 destrói a margem e é lento demais para chat.
Roteamento: `flash` para o turno conversacional e para o classificador de risco;
`pro` apenas para o resumo clínico semanal. Fair use explícito no plano (ver ADR-11).

### ADR-08 — Portal: expand-contract de `/family` para `/portal`
Criar `src/containers/portal/` e migrar por partes. `/family/*` continua funcionando como
redirect permanente. **Atenção crítica:** `src/sw.ts` abre `/family/diary` no clique da push
notification e há PWAs já instalados no celular de 13 famílias — o service worker precisa
tratar as duas rotas durante a transição.

### ADR-09 — `db-f1-micro` mantido, com contingência (revisto por D9)
A recomendação técnica era subir a instância antes de abrir o chat. O product owner optou por
manter e reavaliar quando houver assinantes reais. Risco aceito e documentado; as mitigações
obrigatórias estão em D9. O gatilho objetivo de escalonamento é p95 do chat acima de 3s ou CPU
do Cloud SQL acima de 70% sustentado.

### ADR-10 — Hardening de segurança como pré-requisito, não como fase final
Antes de abrir a porta para o paciente final:
1. Migrar segredos das env vars do Cloud Run para Secret Manager
   (`PGRST_DB_URI`, `PGRST_JWT_SECRET`, `GCP_SERVICE_ACCOUNT`, `CRON_SECRET`).
2. Rate limiting por usuário nas rotas do portal (`rate_limits` já existe).
3. RLS **real** (sem depender de BYPASSRLS) nas tabelas novas do B2C, com testes negativos.
4. Idempotência do webhook Stripe por `event.id`.

### ADR-11 — Billing B2C: produto separado, trial com cartão e webhook polimórfico
- Novo produto Stripe **"Thery — Acompanhante de Apoio"**, R$ 49,90/mês,
  `metadata.account_type='patient'`, criado **direto em live** (D4) e espelhado em test para a
  suíte automatizada.
- **Trial de 7 dias com cartão obrigatório:** `trial_period_days: 7` +
  `payment_method_collection: 'always'` na Checkout Session.
- Tabela `stripe_webhook_events` para idempotência (`event.id` como PK).
- O webhook passa a rotear por `metadata.account_type`: `clinic` (atual) | `patient` (novo).
  Eventos novos a tratar: `customer.subscription.trial_will_end`, `invoice.paid`,
  `invoice.payment_failed`, `customer.subscription.deleted`.
- Tela de gestão da assinatura no portal (D5) e e-mail de aviso 1 dia antes (D6).
- Fair use: teto mensal de mensagens e minutos de áudio, com **degradação suave**
  (não corta o acesso; encurta respostas e avisa). Cortar acesso de alguém em sofrimento por
  estouro de cota é inaceitável — e essa regra não é negociável em nenhuma fase.

### ADR-16 — Nome e persona: "Thery"
O Acompanhante se chama **Thery** (D10), sempre acompanhado do rótulo
"Acompanhante de Apoio · não substitui seu psicólogo" no cabeçalho do chat. Thery nunca se
apresenta como psicóloga, terapeuta ou profissional de saúde, nunca usa "eu recomendo
clinicamente", e sempre devolve temas profundos para a próxima sessão humana.

### ADR-12 — Adolescente (13-17): SELF condicionado, premium só 18+
Acesso `SELF` para adolescente exige consentimento do responsável registrado
(`portal_consent`), e o responsável pode ter acesso `CAREGIVER` simultâneo com visibilidade
reduzida. **Assinatura B2C premium só para 18+** (capacidade civil + LGPD art. 14).

### ADR-13 — Um paciente pode ter N acessos ao portal
O modelo atual é efetivamente 1:1. O novo é 1:N: um adulto com `SELF` + um cuidador com
`CAREGIVER` (caso do TEA adulto com apoio familiar, explicitamente pedido pelo usuário).
`getFamilyPatientLink()` (`_shared/family-access.ts`), que hoje faz `.limit(1)`, precisa ser
reescrito para resolver o vínculo pelo par (usuário, paciente).

### ADR-14 — Nada de `pages/`, nada de modal ad-hoc
Tudo em `src/containers/`. Todo formulário/confirmação usa `StandardModal`. Todo texto de IA
renderiza por `AiMarkdownContent`. Tokens de `identidade-visual.md`.

### ADR-15 — Migrations: dois destinos, um só arquivo-fonte
Toda migration nasce em `supabase/migrations/YYYYMMDDHHMMSS_nome.sql` (última:
`20260820220000`) e é aplicada no Cloud SQL via Cloud SQL Auth Proxy (porta 5433) + `pg`.
Idempotente (`IF NOT EXISTS` / `OR REPLACE`), com backup on-demand antes de qualquer
alteração destrutiva.

---

## 4. Modelo de dados alvo (visão consolidada)

```
patients
  + profile_type          patient_profile_type   CHILD | ADOLESCENT | ADULT
  + active_modules        clinical_module[]      {CLINICO_GERAL, NEURODESENVOLVIMENTO, ...}
  + autonomy_level        patient_autonomy       SELF_MANAGED | SUPPORTED | DEPENDENT
  + support_network       text                   (equivalente adulto de composicao_familiar)
  + occupation_routine    text
  + mapped_triggers       text
  (diagnoses JSONB mantido e sincronizado)

clinical_taxonomy         catálogo curado de condições
patient_conditions        M:N paciente × condição (is_primary, status, noted_at)

patient_family_links
  + access_level          portal_access_level    CAREGIVER | SELF
  + is_primary_contact    boolean
  view patient_portal_links (alias semântico)

diary_entries
  + payload               jsonb                  schema por módulo/perfil
  (mood_score/sleep_quality/crisis_* mantidos para não quebrar 19 registros e o dashboard)

patient_subscriptions     assinatura B2C (stripe_customer_id, stripe_subscription_id,
                          status, trial_end, current_period_end, cancel_at_period_end,
                          trial_warning_sent_at)
patient_copilot_threads   thread do Acompanhante
patient_copilot_messages  role, content, risk_level, is_severe_risk, input_source
patient_consents          consentimentos versionados (termos B2C, compartilhamento clínico)
clinical_alerts           alertas unificados (source: COPILOT_B2C | DIARY | CHECKIN)
stripe_webhook_events     idempotência
```

`crisis_alerts` (11 linhas, gerada por trigger do diário) **não é apagada**: `clinical_alerts`
nasce como o modelo unificado e o feed do dashboard lê os dois durante a transição.

---

## 5. Mapeamento dos 10 prompts → entregas

| # | Tema do usuário | O que eu entrego | Gate |
|---|---|---|---|
| 1 | Kick-off arquitetural | Este documento + validação de acessos | Aprovado |
| 2 | Modelagem DB + RLS | Migration idempotente aplicada no Cloud SQL + RLS + testes negativos + backup | `npm run test:unit` verde, RLS negativo passa |
| 3 | Backend onboarding universal | `create-patient` refatorado (Zod condicional, transação real, roteamento de convite), taxonomia | Deploy Cloud Run + smoke |
| 4 | Wizard condicional | `PatientCreateModal` dinâmico por `profile_type` | Lint/typecheck/testes + build |
| 5 | Portal universal | `src/containers/portal/`, `SmartDiary`, nav reativa, redirects | Testes + PWA validado |
| 6 | Cérebro B2C + guardrails | System prompt, classificador 3 camadas, protocolo de emergência | Bateria de casos de risco |
| 7 | Chat PWA B2C | `PatientChatContainer`, áudio, streaming, card de emergência | Testes + a11y |
| 8 | Motor de alertas | `clinical_alerts`, endpoints, resumo consentido, vetorização do resumo | E2E alerta < 5s |
| 9 | Dashboard de triagem | `ClinicalAlertsFeed`, toast global | Testes |
| 10 | Stripe B2C + QA E2E | Catálogo (test→live), webhook polimórfico, suíte E2E | Caminho dourado completo |

**Fase extra que eu adiciono (não estava no plano):** hardening de segurança (ADR-10) e
Go-to-Market da landing (Fase 6 da visão original, que sumiu na lista de 10 prompts).
Executo junto do Prompt 10 se não houver prompt dedicado.

---

## 6. Riscos técnicos (ordenados por severidade)

| # | Risco | Severidade | Mitigação |
|---|---|---|---|
| R1 | **Falso negativo de risco de vida.** A IA não detectar ideação suicida real | Crítico | ADR-05: 3 camadas, sendo a Camada 0 determinística e independente do LLM. Bateria de casos em PT-BR com gíria/eufemismo. Nenhum turno passa sem classificação |
| R2 | **Vazamento cross-patient no chat B2C.** Paciente A ver dado de B | Crítico | RLS real nas tabelas novas + resolução de `patient_id` sempre server-side pelo vínculo, nunca pelo payload. Testes negativos obrigatórios no gate |
| R3 | **Quebra de confiança clínica.** Paciente descobrir que o desabafo virou insumo do terapeuta | Crítico | ADR-06: resumo consentido, transparência no onboarding, toggle |
| R4 | **Falso positivo em massa.** Terapeuta inundado de alerta e passar a ignorar (fadiga de alarme) | Alto | Só `MODERATE`+ gera alerta; agregação por paciente/dia; `MODERATE` não notifica fora do horário |
| R5 | **Contaminação de contexto entre os dois copilotos.** Prompt B2B vazar no B2C ou vice-versa | Alto | Módulos separados, sem reuso do builder de prompt, testes de fingerprint |
| R6 | **Regressão no ecossistema infantil.** 17 clínicas e 12 famílias em produção | Alto | Nada é removido; tudo é aditivo com default preservando comportamento. Migration idempotente + backup |
| R7 | **`db-f1-micro` sob chat com streaming** | Alto | ADR-09: upgrade antes de abrir o B2C |
| R8 | **Segredos em env var do Cloud Run** | Alto | ADR-10: Secret Manager |
| R9 | **Margem negativa no B2C** | Médio | ADR-07 (flash) + fair use + medição de custo por assinante desde o primeiro dia |
| R10 | **Menor de idade com acesso SELF** | Médio | ADR-12: consentimento do responsável; premium 18+ |
| R11 | **Duplicidade no webhook Stripe** | Médio | `stripe_webhook_events` |
| R12 | **PWA instalado quebrar no rename de rota** | Médio | ADR-08: redirects + SW tratando as duas rotas |
| R13 | **Responsabilidade civil/CFP** — IA confundida com atendimento psicológico | Alto (jurídico) | Nomenclatura "Acompanhante de Apoio" em todo lugar, disclaimer no onboarding e no rodapé do chat, proibição de diagnóstico/fármaco no prompt e no guardrail de saída |

---

## 7. Runbook de execução (comandos reais validados)

```bash
# Cloud SQL Auth Proxy (já validado, porta 5433)
.tools/cloud-sql-proxy --token="$(gcloud auth print-access-token)" \
  --port 5433 plataforma-therapy-ai:us-central1:unithery-pg-staging

# Backup on-demand antes de migration
gcloud sql backups create --instance=unithery-pg-staging \
  --description="pre-migration-<nome>"

# Build + deploy da API
gcloud builds submit --project=plataforma-therapy-ai \
  --config=cloud-run/api/cloudbuild.yaml \
  --substitutions=_IMAGE=us-central1-docker.pkg.dev/plataforma-therapy-ai/unithery-docker/api:staging .
gcloud run deploy unithery-api-staging --region=us-central1 --image=<imagem>

# Deploy do frontend
bash infra/gcp/scripts/05-deploy-fe-gcs.sh

# Qualidade
npm run lint && npm run typecheck && npm run test:unit && npm run build

# Health
curl -s https://unithery-api-staging-708489350104.us-central1.run.app/health
```

---

## 8. Checklist de conformidade (LGPD / ética) — validar em toda entrega

- [ ] Dado de saúde tratado com finalidade específica e informada (art. 11)
- [ ] Consentimento do B2C versionado e auditável (`patient_consents`)
- [ ] Menor de idade com consentimento do responsável (art. 14)
- [ ] Paciente sabe exatamente o que o terapeuta vê
- [ ] Alerta de risco justificado por dever de cuidado, informado antes da assinatura
- [ ] Direito de exclusão: apagar a conta B2C não pode apagar o prontuário do terapeuta
      (bases legais distintas — retenção clínica vs. serviço de apoio)
- [ ] IA nunca se apresenta como psicóloga; disclaimer visível
- [ ] Texto de emergência é constante versionada, jamais gerada por LLM
- [ ] Auditoria (`audit_logs`) em todo acesso a conteúdo do chat B2C

---

## 9. Registro de execução

### Prompt 2 — Modelagem de dados e RLS · CONCLUÍDO em 22/08/2026

**Migration:** `supabase/migrations/20260822160000_b2b_b2c_portal_foundation.sql`
Aplicada no Cloud SQL de produção (`unithery-pg-staging`) via proxy na porta 5433.
Backup on-demand `pre-migration-b2b-b2c-foundation` tirado antes.
Idempotência verificada: 4 execuções consecutivas, mesmo estado final.

**Estruturas criadas**

| Objeto | Papel |
|---|---|
| 7 ENUMs | `patient_profile_type`, `clinical_module`, `portal_access_level`, `patient_autonomy_level`, `clinical_risk_level`, `clinical_alert_source`, `clinical_alert_status` |
| `patients` +7 colunas | `profile_type`, `active_modules`, `autonomy_level`, `support_network`, `occupation_routine`, `mapped_triggers`, `diagnoses_legacy` |
| `clinical_taxonomy` | 64 condições curadas em 12 categorias |
| `patient_conditions` | M:N paciente × condição, com `needs_review` e `raw_label` |
| `patient_family_links` +4 colunas | `access_level`, `is_primary_contact`, `revoked_at`, `last_access_at` |
| view `patient_portal_links` | Nome semântico do portal (ADR-01) |
| `diary_entries` +4 colunas | `payload` JSONB, `author_access_level`, `portal_link_id`, `author_user_id` |
| `patient_subscriptions` | Assinatura B2C, com `trial_end` e `trial_warning_sent_at` (D4/D6) |
| `patient_copilot_threads` / `_messages` | Chat do Thery, isolado do RAG do terapeuta |
| `patient_copilot_usage` | Agregado mensal para fair use sem `count()` pesado (D9) |
| `patient_consents` | Consentimento versionado (LGPD art. 11 e 14) |
| `clinical_alerts` | Triagem unificada: `COPILOT_B2C`, `DIARY`, `CHECKIN`, `MANUAL` |
| `stripe_webhook_events` | Idempotência por `event.id` (ADR-10) |

**Resultado da migração de dados (30 pacientes ativos)**

- `profile_type` derivado da data de nascimento real: **19 CHILD, 6 ADOLESCENT, 5 ADULT**.
  O plano original mandava fixar `CHILD` para todos, o que classificaria errado 11 pacientes.
- `active_modules` = `{CLINICO_GERAL, NEURODESENVOLVIMENTO}` para todos os legados: ninguém
  perde capacidade.
- 38 diagnósticos migrados, **37 casaram automaticamente** com a taxonomia (97%).
  Uma pendência legítima de curadoria: `"TDAH com hipotese de TEA"`, que exige decisão
  clínica e não pode ser inferida por regra.
- Grafias unificadas: `"TEA Nivel 1"`, `"TEA - NIVEL 1"` e `"TEA - Nível 1"` viraram
  `"TEA nível 1"`; `"Transtorno do processamento auditivo central"` virou `"TPAC"`.
- `patients.diagnoses` projeta o **rótulo curto**, preservando o vocabulário do terapeuta.
  O nome clínico completo fica em `clinical_taxonomy.label`, disponível para o RAG.
- Zero pacientes perderam diagnóstico. O texto original está imutável em `diagnoses_legacy`.

**Gates**

| Gate | Resultado |
|---|---|
| `npm run test:rls` | **24/24**, com ROLLBACK — base inalterada |
| `npm run test:unit` | 424 testes, 92 arquivos, verde |
| `npm run typecheck` | limpo |
| `npm run lint` | sem novos erros (13 pré-existentes, em arquivos não tocados) |

**Decisões de segurança materializadas no banco**

1. **O terapeuta não lê o chat do paciente.** Não existe policy de SELECT em
   `patient_copilot_messages`/`_threads` para `professional`, `clinic_admin` ou `master`.
   O ADR-06 deixou de ser uma promessa de aplicação e virou uma garantia do banco.
2. **O paciente não escreve no chat direto.** `authenticated` só tem GRANT de SELECT; um
   INSERT via PostgREST burlaria o classificador de risco (ADR-05).
3. **`is_severe_risk` é coluna gerada** de `risk_level`. Não pode divergir da classificação.
4. **Um único acesso `SELF` por paciente**, garantido por índice único parcial.
5. O paciente **não lê** os alertas gerados sobre ele: exibi-los criaria efeito de
   vigilância e inibiria o relato honesto. A transparência vem pelo texto do consentimento.

**Bug pré-existente corrigido de passagem:** `copilot_threads` e `copilot_messages` (o
copiloto B2B) foram criadas sem GRANT para `unithery_app` e `authenticated`, apenas para
`postgres`. Ambas estavam com 0 linhas em produção — a persistência de thread do copiloto
do terapeuta nunca funcionou via PostgREST. GRANTs adicionados.

**Achado operacional:** o secret `unithery-db-password` no Secret Manager está
dessincronizado da senha que o Cloud Run realmente usa. `scripts/cloudsql-connect.mjs`
tenta as duas fontes. Entra na fila do hardening (ADR-10).

**Ferramentas adicionadas**

- `scripts/cloudsql-connect.mjs` — conexão ao Cloud SQL sem risco de acertar o Supabase legado
- `scripts/apply-cloudsql-migration.mjs` — runner de migration (`npm run db:migrate:cloudsql`)
- `scripts/qa-rls-b2c.mjs` — suíte de isolamento (`npm run test:rls`)
- `src/shared/lib/clinical-profile.ts` — espelho em TS dos ENUMs e regras de derivação

---

### Prompt 3 — Onboarding universal e roteamento de acesso · CONCLUÍDO em 22/08/2026

**Migration:** `supabase/migrations/20260822180000_universal_onboarding.sql`
Aplicada no Cloud SQL de produção. Backup on-demand `pre-migration-universal-onboarding`
tirado antes. Deploy: revisão `unithery-api-staging-00040-xx5`, 100% do tráfego.

#### O que mudou de verdade

| Camada | Entrega |
|---|---|
| Banco | `invites.access_level` + `invited_email`/`invited_name`/`sent_at`/`send_error` |
| Banco | `consume_invite` v2 — propaga `access_level` para o vínculo |
| Banco | `create_patient_tx(jsonb)` — paciente + condições + convite em uma transação |
| Banco | `rollback_patient_creation(uuid)` — desfaz de verdade, arquiva se houver histórico |
| Backend | `_shared/patient-profile.ts` — ontologia e roteamento, espelho do banco |
| Backend | `create-patient` — schema condicional, taxonomia, transação, convite roteado |
| Backend | `generate-invite` — `access_level` derivado + envio de e-mail |
| Backend | `_shared/invite-email{,-templates}.ts` — dois convites, dois tons |

#### Atomicidade: o que foi possível e o que não foi

O prompt pedia `SET LOCAL request.jwt.claims` dentro de uma transação no Deno. Isso não
existe nesta arquitetura: as Edge Functions falam com o Postgres por **PostgREST sobre
HTTP**, não por conexão TCP. Não há `BEGIN`/`COMMIT` do lado do Deno, e cada chamada é uma
transação implícita independente. A autorização também não passa por RLS aqui — o
`create-patient` usa service client e valida clínica/profissional na aplicação.

A transação real, então, foi para onde ela pode existir: **dentro do banco**.
`create_patient_tx` cria paciente, condições clínicas e convite atomicamente.

O contrato financeiro ficou **deliberadamente fora**. Ele é calculado por
`upsertFinancialContract` em TypeScript — janelas de recorrência, pacotes, parcelas — e
reescrever esse motor em plpgsql seria uma reescrita de risco desproporcional ao ganho.
O que mudou é a compensação: antes, contrato falho deixava um paciente *soft-deleted*
órfão no banco. Agora `rollback_patient_creation` apaga paciente, condições e convite de
verdade. E se algo já se apoiou no cadastro (sessão, vínculo, diário), ele **arquiva em vez
de apagar** — nunca destrói histórico clínico por engano.

#### Compatibilidade progressiva: por que `profile_type` é opcional

O prompt pedia `profile_type` e `active_modules` obrigatórios. Torná-los obrigatórios hoje
**quebraria o cadastro de paciente em produção**: o wizard atual não envia nenhum dos dois,
e só passa a enviar no Prompt 4.

A saída não foi afrouxar a regra, foi condicioná-la à adesão do cliente:

- **Cliente que não declara `profile_type`** (o wizard de hoje): o backend deriva o perfil
  da data de nascimento e aplica as regras antigas. Nada quebra.
- **Cliente que declara** (o wizard do Prompt 4): validação estrita. Criança e adolescente
  exigem responsável, composição familiar e e-mail do responsável; adulto exige o próprio
  e-mail.

Em ambos os casos o perfil declarado é **conferido contra a data de nascimento**. Um cliente
não decide sozinho que uma criança de 6 anos é adulta — isso mudaria quem recebe o convite
e quem pode assinar o Acompanhante.

#### Taxonomia clínica: o array livre não foi removido

O prompt afirmava que o array de strings foi removido. Não foi, e por decisão explícita do
ADR-03: `patients.diagnoses` continua existindo como projeção mantida por dual-write. O
endpoint agora aceita `condition_ids` (UUIDs de `clinical_taxonomy`) **e** `diagnoses`
(texto livre), exigindo ao menos um dos dois. O texto livre continua aceito porque o
terapeuta precisa poder registrar uma condição que ainda não está no catálogo — 64 verbetes
não cobrem a clínica inteira.

IDs inexistentes ou desativados são rejeitados com `400` antes de abrir a transação.

#### Roteamento do convite

| Perfil | `access_level` | Destinatário | E-mail |
|---|---|---|---|
| ADULT | `SELF` | o próprio paciente | "criou seu espaço" |
| ADOLESCENT | `CAREGIVER` | responsável | "acompanhar de perto" |
| CHILD | `CAREGIVER` | responsável | "acompanhar de perto" |

São **dois textos distintos**, não o mesmo com troca de nome. O convite SELF não usa as
palavras "família" nem "responsável" — escrever "acompanhe o tratamento do paciente" para
alguém que *é* o paciente soa burocrático e distante. Há teste garantindo isso.

Adolescente **não** recebe acesso autônomo pelo cadastro, mesmo que o parâmetro seja
enviado explicitamente: `generate-invite` rejeita `SELF` para menor. O caminho para isso é
consentimento registrado do responsável, não um parâmetro de convite.

Outras decisões materializadas:

1. **A cota de familiares não penaliza o acesso próprio.** O limite de
   `max_family_members_per_patient` existe para cuidadores; o acesso do próprio paciente
   não é "mais um familiar" e não pode ser bloqueado por uma cota pensada para pais.
2. **Um paciente tem no máximo um acesso SELF ativo**, checado no RPC e garantido por
   índice único parcial.
3. **Falha de e-mail não derruba o cadastro.** O paciente já está salvo quando o SES é
   chamado; a falha vai para `invites.send_error` e o código continua na tela do terapeuta.

#### Rota: continua `create-patient`

O prompt falava em `POST /api/patients`. O roteador do Cloud Run resolve funções **pelo nome
da pasta** (`/functions/v1/{nome}`, `/api/{nome}`, `/v1/{nome}`), e todas as ~115 functions
seguem esse padrão. Renomear para um resource REST quebraria o cliente e criaria uma
exceção solitária na convenção. `POST /api/create-patient` já atende pelo mesmo roteador.

#### Gates

| Gate | Resultado |
|---|---|
| `npm run test:unit` | **449 testes, 93 arquivos** (+25 testes, +1 arquivo) |
| `npm run test:rls` | 24/24, com ROLLBACK |
| `npm run test:onboarding` | **23/23**, com ROLLBACK |
| `npm run typecheck` | limpo |
| `npm run lint` | sem novos erros (13 pré-existentes, em `.d.ts` gerados) |
| `deno check` das functions tocadas | limpo |
| Smoke em produção | RPC e rollback exercitados via HTTP, sem resíduo |

**Ferramenta adicionada:** Deno local em `.tools/deno` (agora no `.gitignore`). O `tsc` não
cobre `supabase/functions` — os imports são URLs remotas. O `deno check` pegou um erro de
tipo real em `create-patient/service.ts` que só apareceria no Cloud Build. Passa a ser
obrigatório antes de deploy de function.

**Achado:** o erro `TS2769` em `_shared/identity-platform-admin.ts` é pré-existente
(confirmado com `git stash`) e vem do Deno 2.9 local ter tipos de `Uint8Array` mais estritos
que o runtime de produção. Não bloqueia, entra na fila de hardening.

#### Pendência aberta para o Prompt 4

O wizard precisa passar a enviar `profile_type`, `active_modules`, `condition_ids`,
`support_network`/`occupation_routine`/`mapped_triggers` e `portal_invite`. Enquanto não
enviar, o backend opera em modo de compatibilidade e o convite só sai se houver e-mail de
contato preenchido.

*Resolvida no Prompt 4.*

---

### Prompt 4 — Wizard de cadastro condicional · CONCLUÍDO em 22/08/2026

Deploy: revisão `unithery-api-staging-00041-rvm`, 100% do tráfego (só o ajuste de
roteamento descrito abaixo; o restante é frontend).

#### O que mudou

| Camada | Entrega |
|---|---|
| Frontend | `PatientProfileTypeCards` — perfil clínico derivado da idade, com a consequência visível |
| Frontend | `PatientConditionPicker` + `clinical-taxonomy.ts` — busca nos 64 verbetes curados |
| Frontend | `PatientAnamnesisWizard` — passos 1, 3, 4 e 5 mudam de conteúdo por perfil |
| Frontend | `patient-anamnesis.validation.ts` — validação condicional espelhando o backend |
| Frontend | `patient-create-payload.ts` — envia a ontologia completa do Prompt 3 |
| Frontend | `patient-created-message.ts` + toast — o terapeuta sabe se o convite saiu |
| Frontend | `PatientIdentityToggle` — copy "O paciente não possui CPF próprio" |
| Backend | `resolveInviteRouting` passa a considerar o escopo de contato (correção) |

#### Perfil clínico: cartões, mas não um seletor

O prompt pedia radio cards para o terapeuta **escolher** entre Criança, Adolescente e
Adulto. Os cartões existem, com ícone e faixa etária, mas **não são clicáveis**: o perfil é
derivado da data de nascimento.

O motivo é concreto, não estético. O backend do Prompt 3 confere o perfil declarado contra
a data de nascimento e recusa divergência — foi assim que se impediu que um cliente
decidisse sozinho que uma criança de 6 anos é adulta, o que mudaria quem recebe o convite e
quem pode assinar o Acompanhante. Um seletor livre no passo 1 produziria, portanto, um erro
de validação **depois de seis passos preenchidos**, e o terapeuta teria que descobrir
sozinho que o culpado era um cartão que o próprio formulário deixou ele clicar.

Além disso, a idade não é uma opinião clínica. O que os cartões fazem, então, é o que um
seletor não faria: mostram a consequência da data digitada — "Portal do responsável,
dinâmica familiar e hiperfocos" — para que a mudança dos passos seguintes não pareça
arbitrária quando acontecer.

#### `react-hook-form` não foi introduzido

O prompt pedia RHF com `useWatch`. O pacote **não está instalado** e o wizard inteiro é
controlado com `useState`, compartilhando o tipo `PatientAnamnesisForm` com a ficha clínica
(`PatientClinicalRecordTab`) e o contrato financeiro (`PatientContractFields`).

Migrar para RHF junto com a lógica condicional significaria trocar a fundação do formulário
e o comportamento dele na mesma entrega, com o raio de impacto passando pela ficha clínica
e pelo setup financeiro pós-cadastro. São dois trabalhos independentes: o objetivo aqui é o
wizard condicional, não a biblioteca de estado. A reatividade que o `useWatch` daria já
existe — `profileFromForm(form)` recalcula a cada render e os passos seguem.

Fica registrado como dívida técnica com escopo próprio.

#### Correção de roteamento herdada do Prompt 3

Ao ligar o passo 5, apareceu um furo no `resolveInviteRouting`: ele decidia o
`access_level` **só pelo perfil**. Um adulto acompanhado por um cuidador (curatela, TEA
adulto, quadro grave) receberia `SELF` — e o convite iria para o e-mail do cuidador com
acesso ao espaço pessoal do paciente.

A regra agora combina o que é permitido (idade) com o que foi pedido (escolha do
terapeuta): adulto com contato apenas do apoiador gera `CAREGIVER`; menor de idade continua
`CAREGIVER` sempre, mesmo se o escopo pedir o paciente.

#### Passo 5: acesso ao portal, não só "contato"

A pergunta passou a ser "Quem terá acesso ao Portal Unithery?", e as opções mudam com o
perfil. Menor de idade **não vê** a opção "o próprio paciente" — o acesso autônomo de
adolescente depende de consentimento registrado (ADR-12) e não é uma escolha de cadastro.
Adulto vê as três: o próprio paciente, uma pessoa de apoio, ou ambos.

Dois detalhes que fecham o fluxo:

1. **Corrigir a data de nascimento limpa uma escolha que deixou de existir.** Trocar a data
   de adulto para criança invalida "o próprio paciente"; a seleção é apagada em vez de
   virar um valor fantasma que o backend recusaria no fim.
2. **O convite pode ficar para depois.** Um checkbox permite cadastrar sem enviar — nem todo
   cadastro acontece com a família pronta para receber e-mail.

#### O convite deixou de sair em silêncio

Antes, o modal fechava sem dizer nada. O envio do convite acontece fora da tela: se
falhasse, o terapeuta só descobriria quando a família reclamasse de não ter recebido nada.
Agora o cadastro devolve um toast que diz para quem o convite foi e, quando o SES falha,
avisa em vermelho e entrega o código de acesso.

#### Taxonomia clínica ganhou UI

A tabela `clinical_taxonomy` existia desde o Prompt 2 sem nenhum consumidor no frontend. O
seletor busca por rótulo, nome clínico, código e **sinônimos** — quem digita "autismo" acha
TEA, quem digita "burnout" acha esgotamento profissional. Os 64 verbetes são carregados uma
vez e filtrados no cliente, com cache de 24h.

O campo de texto livre continua ao lado, coerente com o ADR-03. Forçar a escolha da lista
faria o terapeuta encaixar o paciente no rótulo mais próximo, o que é pior para o
prontuário e para o RAG do que registrar o termo real.

Leitura validada em produção: policy `clinical_taxonomy_read` (`USING active`) com `GRANT
SELECT` para `authenticated`, 64 verbetes visíveis ao role `professional`.

#### Gates

| Gate | Resultado |
|---|---|
| `npm run test:unit` | **481 testes, 94 arquivos** (+32 testes, +1 arquivo) |
| `npm run test:onboarding` | 23/23, com ROLLBACK |
| `npm run typecheck` | limpo |
| `npm run lint` nos arquivos tocados | limpo (1 warning pré-existente de `exhaustive-deps`) |
| `npm run build` | ok |
| `deno check` de `create-patient` e `generate-invite` | limpo |
| Smoke | API `health=200`; leitura da taxonomia validada por SQL com role `authenticated` |

#### Pendências abertas

1. **Ficha clínica não expõe os campos novos.** `support_network`, `occupation_routine` e
   `mapped_triggers` são gravados no cadastro mas ainda não aparecem em
   `PatientClinicalRecordTab`, porque `update-patient` ainda não os aceita. O cadastro
   funciona; a edição posterior desses três campos, não.
2. **Migrar o wizard para `react-hook-form`**, como trabalho isolado.
3. **Reenvio de convite pela ficha do paciente** — hoje o caminho é `generate-invite`, sem
   UI dedicada. Necessário para quem marcar "enviar depois".

---

### Prompt 5 — Portal universal de duas pontas · CONCLUÍDO em 22/08/2026

Migration: `supabase/migrations/20260822190000_portal_diary_self_visibility.sql`
(calendário de check-ins do terapeuta passa a devolver gatilhos, escalas 1–10 e autor).
Deploy: revisão `unithery-api-staging-00042-695`, 100% do tráfego.

#### O que mudou

| Camada | Entrega |
|---|---|
| Rotas | `/portal/*` canônico; `/family/*` redireciona (PWA já instalado) |
| Layout | `PortalLayout` com bottom nav reativa por `access_level` |
| Contexto | `get-portal-context` + `usePortalContext` — o servidor decide o modo |
| Diário | `SmartDiary` — observação (cuidador) vs auto-relato (paciente) |
| Nav | CAREGIVER: Diário / Calendário / Combinados; SELF: Meu dia / Histórico / Plano; Apoio só com assinatura |
| Terapeuta | Check-ins e modal do diário leem `payload` e `author_access_level` |
| PWA | shortcut "Portal" → `/portal/diary`; `sw.ts` já abria essa rota |
| Limpeza | `src/containers/family/` removida (cópia morta) |

#### Duas divergências do prompt

**1. O modo não é escolhido no login, é lido do vínculo.** O prompt falava em
`/api/portal/me`. A função existe como `get-portal-context` — o roteador do Cloud Run
resolve pelo nome da pasta, como todas as outras. O cliente não declara `SELF` ou
`CAREGIVER`: o servidor lê `patient_family_links.access_level`. Declarar no PWA
permitiria a um cuidador gravar entradas assinadas como se fossem do paciente.

**2. Os chips do diário leem o perfil, não só o `access_level`.** O prompt pedia
CAREGIVER infantil vs SELF adulto. Um cuidador de adulto (curatela, TEA adulto) não
pode ver "escola" e "agitação" — isso descreve o dia de uma criança. A UI troca o
vocabulário pelo `profile_type`; o backend aceita o conjunto união, para um perfil
corrigido depois não apagar check-ins válidos.

O `active_modules` entra no contexto e alimenta o gating do Acompanhante (Prompt 7).
Não troca as perguntas do diário sozinho: o ato (observar vs relatar) é o
`access_level`; o vocabulário é a idade.

#### O que o prompt pedia e já estava no repositório

Rotas, `PortalLayout`, `SmartDiary`, `SelfReportFields`, `portal-nav` e
`get-portal-context` já existiam como esqueleto. Esta entrega fechou o que ainda
quebrava a promessa: testes (comentários afirmavam que existiam e não existiam),
copy das telas secundárias ("seu filho(a)" no plano de cuidados de um adulto),
leitura clínica do auto-relato, e a pasta `family/` que ninguém mais importava.

#### Chat B2C

`PortalCompanion` (`/portal/apoio`) é um placeholder com gating real: só aparece
na nav se `capabilities.companion_chat` for verdadeiro (SELF + adulto + assinatura
ativa). A conversa em si é o Prompt 7.

#### Gates

| Gate | Resultado |
|---|---|
| `npm run test:unit` | **505 testes, 96 arquivos** |
| `npm run typecheck` | limpo |
| `npm run lint` nos arquivos tocados | limpo |
| `npm run build` | ok, PWA gerado |
| `deno check` de `get-portal-context`, `submit-diary`, `get-patient-record` | limpo |
| Migration Cloud SQL | aplicada |
| Smoke | `health=200`; `get-portal-context` responde 401 sem token (função no ar) |

#### Pendências abertas

1. Chat do Acompanhante — Prompt 7. O cérebro (`query-patient-companion`) já está no ar.
2. Assinatura B2C no portal — Prompt 10; `can_subscribe` já volta no contexto.
3. Copy residual em textos de marketing do cadastro do terapeuta ("comunicação com
   famílias") — não afeta o PWA do paciente.

---

### Prompt 6 — Cérebro do Thery e guardrails · CONCLUÍDO em 22/08/2026

Deploy: revisão `unithery-api-staging-00043-x7h`. Function `query-patient-companion`
no ar (401 sem token).

#### O que mudou

| Camada | Entrega |
|---|---|
| Persona | `thery-prompt.ts` — Thery, Acompanhante de Apoio, respostas curtas, coping |
| Camada 0 | `risk-lexicon.ts` — léxico PT-BR, ~1ms, gíria e eufemismo |
| Camada 1 | `risk-classifier.ts` — `gemini-2.5-flash` + JSON `{ risk_level, rationale, signals }` |
| Camada 2 | `emergency-protocol.ts` — texto FIXO (CVV 188, SAMU 192, CAPS, aviso ao terapeuta) |
| Camada 3 | `output-guardrails.ts` — sem diagnóstico, sem fármaco, sem "sou sua psicóloga" |
| Persistência | `patient_copilot_*` via service role + `clinical_alerts` em SEVERE (dedupe/dia) |
| API | `POST /functions/v1/query-patient-companion` (stream NDJSON ou JSON) |

#### Divergências do prompt

**1. Não é um JSON envelope na mesma chamada do chat.** O prompt pedia a Vertex
devolver texto + metadados de risco juntos. Isso mata o streaming (ADR-05): o
paciente em crise esperaria o bloco inteiro, e se o modelo falhasse a detecção
sumiria junto. O classificador roda **em paralelo**, com schema próprio. A
Camada 0 nem espera o LLM.

**2. Motor é `gemini-2.5-flash`, não pro.** ADR-07: pro a R$ 49,90/mês com uso
24/7 destrói a margem e é lento demais para chat. Pro fica para o resumo
clínico semanal (Prompt 8).

**3. O texto de emergência não é gerado pelo modelo.** Um LLM inventar o número
do CVV é inaceitável. A constante `EMERGENCY_PROTOCOL_VERSION` é revisada por
humano. O frontend espelha o mesmo texto (`thery-emergency.ts`) e o teste
garante que os dois não divirjam.

**4. Léxico SEVERE nunca é rebaixado.** O prompt dizia "a IA para o raciocínio
normal" quando o JSON viesse SEVERE. Aqui, "vou me matar" dispara o protocolo
mesmo se o classificador chamar de LOW ou falhar. O inverso também vale: o
classificador pode subir um eufemismo que o léxico só marcou como suspeito.

#### Bateria de casos

16 testes cobrem: ideação explícita, eufemismo ("quero sumir", "dormir e não
acordar"), idioma que NÃO é risco ("morrer de vergonha"), abuso sexual,
rebaixamento proibido, classificador falho, persona sem vazamento do copiloto
clínico, e o protocolo com 188/192.

#### Gates

| Gate | Resultado |
|---|---|
| `npm run test:unit` | **521 testes, 97 arquivos** |
| `npm run typecheck` | limpo |
| Smoke | `health=200`; `query-patient-companion` → 401 sem token |

#### Pendência para o Prompt 7

A UI do chat (`PortalCompanion`) ainda é placeholder. A API já classifica, grava,
dispara alerta e faz stream. O Prompt 7 só precisa ligar o fio.
