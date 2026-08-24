# Unithery — Relatório de estado atual da plataforma

**Documento de briefing para análise e plano de modernização**  
**Data de corte:** 17 de agosto de 2026  
**Razão social:** SYNES TECH · **CNPJ:** 47.465.014/0001-44  
**Produto:** Unithery (`unithery.com`)  
**Repositório:** `plataforma-therapy-ia`  
**Público deste texto:** outra IA / time de produto, para desenhar a expansão de “plataforma de terapia infantil (TEA/TDAH)” para “plataforma para qualquer psicólogo, com módulo especial de desenvolvimento infantil / TEA”.

---

## Como usar este documento

Este relatório descreve **o que existe hoje**, como foi construído, com quais linguagens, dependências, lógicas e jornadas. Ele **não é o plano de modernização**. O plano deve nascer depois, a partir deste inventário.

A tese de expansão pedida pelo produto:

> A Unithery deve servir a **todo tipo de psicólogo**. O que hoje é o núcleo (criança + família + TEA/TDAH) vira um **módulo especial e adicional**. O fluxo de criação de paciente, o portal (hoje “família”) e as visões clínicas precisam se adaptar à condição do paciente (TEA, TDAH, ansiedade, depressão e demais quadros).

O que a IA receptora deve produzir, em etapa seguinte:

1. O que é **núcleo genérico** (serve a qualquer psicólogo).
2. O que é **módulo infantil / TEA / desenvolvimento**.
3. O que muda no **cadastro do paciente**.
4. O que muda no **portal** (família → paciente, e quando cada um aparece).
5. O que muda nas **visões** do terapeuta e do paciente/familiar por tipo de condição.
6. Um plano faseado de modernização, sem quebrar o que já está em produção.

---

# Parte I — O que é a Unithery

## 1.1 Definição

A Unithery é um SaaS clínico com IA copiloto. Ela conecta o terapeuta ao contexto da vida do paciente **entre as sessões**, organiza o prontuário, transcreve e estrutura evoluções, e gera hipóteses — sem substituir a decisão clínica.

A frase de produto da landing atual resume a tese original:

> “O cuidado **continua** entre as sessões.”  
> “A criança não conta como foi a semana. A família conta.”

Hoje a plataforma foi desenhada, copyada, modelada e vendida para **terapeutas de crianças com TEA, TDAH e outras demandas do desenvolvimento**. A arquitetura técnica, porém, já é multi-tenant e isolada por paciente — o que permite generalizar sem reescrever o núcleo de segurança.

## 1.2 Problema que resolve hoje

| Dor | Como a Unithery ataca |
|---|---|
| Terapeuta gasta horas cruzando WhatsApp, caderno e memória para montar a sessão | Diário da família + briefing da manhã + copiloto com RAG do paciente |
| Relatório de evolução escrito à mão depois da sessão | Ditado / texto → Vertex estrutura nota → terapeuta lapida e aprova |
| Família não consegue relatar a semana de forma útil | PWA mobile com check-in rápido (humor, sono, crise, chips) ou áudio |
| Uso de ChatGPT público com dados clínicos | IA isolada por `patient_id`, PII mascarada, dado não treina modelo público |
| Honorários e recorrência soltos em planilha | Módulo financeiro do consultório (solo) + contrato no cadastro do paciente |
| Assinatura e cotas manuais | Stripe + paywall de pacientes e interações de IA |

## 1.3 Objetivo de produto (atual)

1. Devolver horas à semana do terapeuta.
2. Manter continuidade clínica entre sessões.
3. Isolar o contexto de cada paciente (LGPD + ética).
4. Fazer a IA **debater** com o terapeuta, não decidir no lugar dele.
5. Monetizar por cota de pacientes + sessões + interações de IA.

## 1.4 Objetivo de expansão (pedido deste briefing)

Tornar a Unithery uma plataforma **para qualquer psicólogo**, mantendo um **módulo especial** para o cenário atual (criança + família + TEA/TDAH/desenvolvimento). Isso implica redesenhar:

- quem é o “segundo usuário” (família vs. o próprio paciente);
- quais campos nascem no cadastro;
- quais telas, chips, diários e prompts a IA usa;
- como a landing, o pricing e o onboarding falam com públicos diferentes.

## 1.5 Diferenciais já implementados

- IA de perfil **individualizado e isolado** por paciente (RAG + thread persistente).
- Copiloto que cita fonte (diário, sessão, anexo, inventário).
- Markdown clínico renderizado (`AiMarkdownContent`) — nunca `**` cru na UI.
- Preview de convite familiar: o botão só habilita depois que o código mostra o **nome do paciente**.
- Workspace de sessão multimodal (áudio + texto) com revisão humana obrigatória.
- Paywall real (Stripe) + plano Free de 1 paciente.
- Financeiro do consultório (receitas, despesas, planos, classificação de sessão).

---

# Parte II — Público-alvo

## 2.1 Público atual (o que o código e a landing afirmam)

**Comprador / usuário pagante**

- Terapeuta autônomo (psicólogo, TO, fono, psicopedagogo) — **este é o go-to-market real**.
- A UI de clínica corporativa existe no backend, mas o lançamento está travado em solo: `PRODUCT_LAUNCH.soloProfessionalOnly = true`.

**Segundo usuário (não paga a Unithery)**

- Familiar / responsável da criança.
- Acessa um PWA mobile-first chamado **Portal da Família**.
- Não vê o copiloto. Vê diário, calendário de check-ins, relatórios e combinados compartilhados.

**Paciente**

- Hoje o paciente é, na prática, **uma criança**. Ele não tem login próprio.
- O cadastro assume responsável, CPF próprio ou do responsável, escolaridade, hiperfocos, escola, sensorial.

**Público da landing**

> “Feito para terapeutas de crianças com TEA, TDAH e outras demandas do desenvolvimento.”

## 2.2 Papéis no sistema (RBAC)

```
Master (SYNES / Unithery)
  └── Clínica / Consultório (tenant)
        ├── clinic_admin          (gestão de equipe — UI parcialmente pronta)
        ├── professional          (terapeuta; se is_solo, é também owner)
        └── family                (responsável vinculado a 1+ pacientes)
```

Claims no JWT (Identity Platform / Firebase): `role`, `clinic_id`, `is_solo`.

| Role | O que vê |
|---|---|
| `professional` | Dashboard clínico, agenda, pacientes, copiloto, sessão. Financeiro e Settings se `is_solo`. |
| `clinic_admin` | Dashboard da clínica, profissionais, pacientes. Sem financeiro solo. |
| `family` | Apenas `/family/*` (diário, calendário, relatórios). Redirect de `/dashboard` → `/family/diary`. |
| `master` | Placeholder “Painel Master em desenvolvimento”. Acesso amplo no backend. |

## 2.3 Público futuro (hipótese a validar no plano)

| Persona | Relação com a Unithery hoje | O que a expansão exige |
|---|---|---|
| Psicólogo infantil TEA/TDAH | Núcleo atual | Vira **módulo especial** |
| Psicólogo clínico adulto (ansiedade, depressão, TOC, etc.) | Quase sem suporte de copy, diário e cadastro | Núcleo genérico + portal do **paciente** |
| Adolescente | Não modelado | Decisão: responsável + paciente, ou só paciente |
| Casal / família em terapia | Não modelado | Fora do escopo imediato, mas o “portal família” não deve ser apagado |
| Clínica multidisciplinar | Backend existe, UI de lançamento desligada | Reativar depois do núcleo genérico |

---

# Parte III — Stack, linguagens, dependências e como se constrói

## 3.1 Linguagens por camada

| Camada | Linguagem | Runtime | Onde mora |
|---|---|---|---|
| Frontend PWA | TypeScript + React 18 | Browser / Vite 5 | `src/` |
| Estilo | Tailwind CSS 3 + tokens do Design System | Build-time | `src/app/globals.css`, `tailwind.config.ts` |
| Backend API | TypeScript (Deno) | Cloud Run (container) + legado Supabase Edge | `supabase/functions/` + `cloud-run/api/` |
| Banco | SQL (PostgreSQL 17 no GCP, 15 no legado) | Cloud SQL / Supabase | `supabase/migrations/`, `infra/gcp/sql/` |
| IA | TypeScript chamando Vertex AI | Mesmo runtime da API | `_shared/vertex.ts` |
| Auth | TypeScript + Firebase JS / Admin | Browser + API | `src/shared/lib/firebase.ts`, `_shared/auth.ts` |
| Infra | Bash + YAML + SQL | GCP | `infra/gcp/`, `cloud-run/` |
| Testes | TypeScript | Vitest, Playwright, axe-core | `src/**/*.test.ts`, `tests/` |

Não há backend Python/Java/Go de produto. O “backend” é um **router Deno** que carrega 114 handlers no mesmo padrão das antigas Edge Functions.

## 3.2 Dependências de produto (npm)

**Runtime**

- `react` / `react-dom` 18 — UI
- `react-router-dom` 6 — rotas
- `@tanstack/react-query` 5 — estado de servidor
- `zustand` 4 — estado leve (auth store)
- `@supabase/supabase-js` 2 — cliente HTTP (hoje apontado para Cloud Run)
- `firebase` 12 — Identity Platform (login, Google, MFA SMS)
- `zod` 3 — validação de schemas (FE e API)
- `dompurify` — sanitização de HTML/markdown
- `@tiptap/*` — editor rico (anotações de sessão)
- `@react-pdf/renderer` — PDFs clínicos
- `stripe` — billing
- `@google-cloud/storage` — signed URLs / ops de objeto
- `vite-plugin-pwa` + Workbox 7 — PWA / service worker

**Qualidade**

- TypeScript 5.5, ESLint 9, Prettier, Vitest 2, Playwright, Testing Library, axe-core

## 3.3 Como o time constrói (método)

O repositório é orquestrado por agentes especialistas (arquivos na raiz):

| Agente | Arquivo | Papel |
|---|---|---|
| 0 Orquestrador | `agente-orquestrador.md` | Fases, dependências, gates |
| 1 Frontend | `agente-frontend.md` | React PWA, UI, a11y |
| 2 Backend | `agente-backend.md` | Functions, auth, RBAC |
| 3 IA | `agente-iagenerativa.md` | RAG, prompts, guardrails |
| 4 DBA | `agente-dba-dados.md` | Schema, migrations, pgvector |
| 5 QA | `agente-qa.md` | Unit, integração, E2E |
| 6 Segurança | `agente-seguranca.md` | AppSec, LGPD |

**Ordem obrigatória de entrega:** DBA → Backend → Frontend. IA em paralelo com Backend. QA depois. Segurança fecha.

**Regras de UI que já são lei no código**

- Modais de criação/edição: só `src/shared/ui/StandardModal.tsx` (desktop central, mobile bottom sheet).
- Markdown de IA: só `src/shared/ui/AiMarkdownContent.tsx`.
- Identidade: `identidade-visual.md` — High-Tech Minimal claro, fundo `#F8FAF9`, primary `#1A86E2`, IA `#7C3AED`.
- Convite familiar: preview assíncrono; confirmação só após `preview-invite` válido.
- Isolamento: nunca cruzar `patient_id` em query de IA.

## 3.4 Organização do frontend (Feature-Sliced)

```
src/
  app/                 rotas, providers, PWA, CSS global
  containers/          telas roteáveis (NÃO usar pages/)
  features/            pedaços de domínio (DiagnosisChips, legal, etc.)
  shared/ui            Design System
  shared/lib           auth, supabase client, planos, firebase
  shared/hooks
```

Containers atuais: `admin`, `auth`, `billing`, `calendar`, `checkout`, `copilot-workspace`, `dashboard`, `family`, `financeiro`, `help`, `landing`, `layout`, `loading`, `patient`, `paywall`, `pdf`, `settings`. Há legado sem rota (`copilot/`, `reports/`).

---

# Parte IV — Arquitetura lógica

## 4.1 Diagrama do valor (ciclo atual)

```
Família registra a semana no PWA (texto ou áudio)
        ↓
Diário + crises entram no banco isolado do paciente
        ↓
Terapeuta abre o dashboard / prontuário / copiloto
        ↓
IA cruza diário + sessões + anexos (RAG 768d, patient_id obrigatório)
        ↓
Sessão: áudio e/ou texto → Vertex estrutura → humano aprova
        ↓
Nota aprovada vira embedding + pode ser compartilhada com a família
        ↓
Combinados / documentos / ficha clínica voltam ao portal da família
```

Esse ciclo **assume um cuidador**. É o principal acoplamento à tese infantil.

## 4.2 Diagrama técnico (produção em 17/08/2026)

```
Browser PWA (unithery.com)
    │  Cloud CDN + GCS  (gs://unithery-fe-staging)
    ▼
Identity Platform (Firebase)  — login e-mail, Google, MFA SMS
    │  JWT
    ▼
Cloud Run  unithery-api-staging
    ├── /functions/v1/:nome     114 handlers Deno
    ├── /rest/v1                PostgREST → Cloud SQL
    └── /health
         │
         ├── Cloud SQL PostgreSQL 17 + pgvector
         ├── GCS (áudios, anexos, avatares)
         ├── Vertex AI (gemini-2.5-pro + gemini-embedding-001)
         ├── AWS SES (auth, sessão, billing, contato)
         └── Stripe (checkout, webhook, portal)
```

**Legado ainda no ar para rollback:** projeto Supabase `yfzhjdfvaosezyjvbyid` (Postgres 15 + Edge Functions). O frontend de produção **não aponta mais para ele**.

## 4.3 Padrão de API

Quase toda regra de negócio passa por Edge Function / handler Deno, **não** por PostgREST direto em domínio sensível.

- Autenticação: `authenticateRequest` lê JWT Firebase.
- Autorização: `requireRole`, `verifyProfessionalPatientWrite`, `assertFamilyOwnsPatient`.
- O client usa service role no servidor (bypassa RLS) e aplica authZ em código.
- RLS no Postgres é **defesa em profundidade** (~109 policies), recriada no Cloud SQL via `auth.uid()` / `auth.jwt()` de compatibilidade (`infra/gcp/sql/001_auth_compat.sql`).

## 4.4 Contratos e validação

- Entrada de function: Zod (`schema.ts` ao lado do `index.ts`).
- Resposta: envelope `{ success, error, meta.request_id }`.
- FE: TanStack Query + `callFunction` / `supabase-js` reescrito para `VITE_GCP_API_URL`.

---

# Parte V — Infraestrutura GCP (detalhe)

## 5.1 Projeto e região

| Item | Valor |
|---|---|
| Projeto GCP | `plataforma-therapy-ai` |
| Região principal | `us-central1` |
| Domínio | `unithery.com` / `www.unithery.com` |
| IP do load balancer | `136.69.93.249` |
| Empresa | SYNES TECH |

## 5.2 Serviços em uso

| Serviço GCP | Recurso | Função |
|---|---|---|
| Cloud Run | `unithery-api-staging` | API única (Deno + PostgREST). Produção de fato, apesar do sufixo staging. |
| Artifact Registry | `unithery-docker` | Imagem da API |
| Cloud Build | `cloud-run/api/cloudbuild.yaml` | Build da imagem |
| Cloud SQL | `unithery-pg-staging` | PostgreSQL 17, Enterprise, pgvector 0.8.1 |
| Cloud SQL Auth Proxy | local / sidecar | Acesso admin e app |
| Identity Platform | Firebase no mesmo projeto | Auth, Google, MFA SMS, custom claims |
| Cloud Storage | 6 buckets | FE público + 5 de dados clínicos |
| Cloud CDN + HTTPS LB | `unithery-fe-staging-map` | SPA + certificado gerenciado |
| Certificate Manager | `unithery-fe-cert` | `unithery.com` + www |
| Vertex AI | us-central1 | LLM, embeddings, STT, extração de PDF |
| Cloud Scheduler | 3 jobs | fila de e-mail de sessão, sync Stripe, lembretes |
| IAM / SA | `unithery-runtime`, `cursor-agent-480` | Runtime e bootstrap |

## 5.3 Buckets GCS

| Bucket | Conteúdo | Acesso |
|---|---|---|
| `unithery-fe-staging` | Build Vite (SPA/PWA) | Público + CDN |
| `unithery-audio-recordings-staging` | Áudio de sessão e copiloto | Privado, signed URL V4 |
| `unithery-family-diary-audio-staging` | Áudio do diário da família | Privado |
| `unithery-pacientes-anexos-staging` | PDF/Word/TXT da ficha | Privado + vetorização |
| `unithery-pacientes-avatars-staging` | Foto do paciente | Privado |
| `unithery-profissionais-avatars-staging` | Foto do terapeuta/admin | Privado |

Paths típicos: `{clinic_id}/{patient_id}/...` ou `{clinic_id}/{user_id}/avatar.jpg`.

O código de storage (`_shared/object-storage.ts`) está **GCS-only**. Documentos antigos ainda falam em dual-read Supabase — desatualizado.

## 5.4 Frontend em produção

- Build: `npm run build` (tsc + Vite + injectManifest do SW).
- Publish: `infra/gcp/scripts/05-deploy-fe-gcs.sh` → rsync para `gs://unithery-fe-staging`.
- `index.html` com `Cache-Control: no-cache`.
- SPA: 404 do bucket reescreve para `index.html` (rotas `/ajuda`, `/login`, `/family/diary`, etc.).
- Env de produção no build: `VITE_SUPABASE_URL` e `VITE_GCP_API_URL` = URL do Cloud Run; `VITE_FIREBASE_*` do `.env`.

## 5.5 API Cloud Run

- Router: `cloud-run/api/main.ts` varre `supabase/functions/*/index.ts` e registra 114 handlers.
- Path compatível com o FE antigo: `/functions/v1/:name`.
- Health: `{"ok":true,"service":"unithery-api","handlers":114}`.
- Revisão observada em 17/08/2026: `unithery-api-staging-00037-9q6`.

## 5.6 Auth

- Identity Platform: e-mail/senha + Google.
- MFA SMS habilitado na plataforma (`PHONE_SMS`, locale `pt`).
- UI de enroll: Settings → Segurança (`MfaSettingsSection`).
- Desafio no login: `MfaSmsChallengeModal`.
- Domínio custom de auth: `VITE_FIREBASE_AUTH_DOMAIN=unithery.com` (handler `/__/auth/handler` via CDN).
- Import histórico: 36 usuários bcrypt do GoTrue, com claims.

## 5.7 Fora da GCP (e por quê)

| Serviço | Vendor | Motivo |
|---|---|---|
| E-mail transacional | **AWS SES** `us-east-1` | Já em produção (quota 50k/dia). From `contact@unithery.com`. |
| Billing | **Stripe** | Checkout, assinatura, webhook, portal. |
| Push | **Web Push VAPID** | Lembrete de diário no PWA. |

## 5.8 Jobs agendados

1. Processar fila `session_email_jobs` (confirmação, 24h, reagendamento, cancelamento).
2. `sync-stripe-subscriptions` (rede de segurança diária).
3. Lembretes de sessão / diário.

## 5.9 O que ainda é “staging” no nome

Quase tudo em GCP ainda se chama `*-staging`. Na prática, o DNS de `unithery.com` já aponta para esse stack. Qualquer plano de modernização deve tratar isso como **produção**, e eventualmente renomear/separar um staging de verdade.

## 5.10 Visão de custo (lógica, não planilha confidencial)

Os custos variáveis da Unithery nascem de:

1. **Vertex** — tokens de chat (`gemini-2.5-pro`), embeddings 768d, áudio inline, extração de documento.
2. **Cloud Run** — CPU/RAM do router Deno.
3. **Cloud SQL** — instância sempre ligada.
4. **GCS + CDN** — armazenamento e tráfego.
5. **Identity Platform / SMS MFA** — custo por SMS.
6. **SES** — baixo (transacional).
7. **Stripe** — taxa de cartão.

O catálogo de planos foi precificado para caber nisso com margem de áudio de **+30%** sobre `sessões × duração`. Há um relatório de custo unitário em `docs/relatorio-custo-unitario-unithery.html`.

A cota de IA (`ai_usage_events` + RPC `check_ai_interaction_quota`) é o freio financeiro do copiloto.

---

# Parte VI — Segurança, LGPD e isolamento

## 6.1 Princípios

- Multi-tenant por `clinic_id`.
- Isolamento clínico por `patient_id` em **toda** query de IA.
- A IA de um caso nunca lê embedding, diário ou sessão de outro.
- Dado clínico **não** treina modelo público (Vertex em projeto próprio, sem fine-tune com base de clientes).
- Unithery atua como **Operadora**; o terapeuta é o controlador do prontuário.

## 6.2 Controles

| Controle | Onde |
|---|---|
| JWT + claims | Identity Platform |
| AuthZ na API | `_shared/auth.ts`, `verify-patient-access.ts`, `family-access.ts` |
| RLS | policies por role / clinic / patient |
| Rate limit | `preview-invite`, login (`guard-auth-rate`), alguns writes |
| PII para LLM | `anonymizeForLLM` (CPF, telefone, e-mail) |
| Guardrail de saída | proíbe nome de medicamento, diagnóstico definitivo, “cura” |
| Audit | `audit_logs` (IA, família, billing) |
| Soft delete | pacientes, threads, mensagens, notas |
| Signed URL | tempo limitado, checagem de clínica |
| Preview de convite | evita vínculo no paciente errado |

## 6.3 Implicação para a modernização

O isolamento **já é genérico**. Não precisa ser redesenhado para atender adulto com depressão. O que é específico de criança está na **camada de produto** (campos, copy, diário, portal, prompts), não no motor de tenant.

---

# Parte VII — Plataforma do terapeuta (núcleo atual)

Esta é a “seção geral” da plataforma: o que o profissional usa depois do login.

## 7.1 Autenticação e onboarding do terapeuta

**Rotas:** `/login`, `/register`, `/auth/confirm`, `/forgot-password`, `/reset-password`.

**Login**

- Toggle Terapeuta / Família (`/login?mode=family`).
- E-mail/senha via Firebase; fallback histórico documentado para GoTrue (código atual é Firebase-first).
- Google OAuth.
- MFA SMS se a conta tiver segundo fator.

**Registro (`/register`)**

- Só consultório solo na UI.
- `register-clinic` com `account_type: 'solo'`.
- Cria clínica + professional + claims `is_solo=true`.
- Entra no plano **Free** (1 paciente) até assinar.
- Confirmação de e-mail por SES.

**Pós-login:** `/dashboard`.

## 7.2 Dashboard profissional

**Arquivos:** `src/containers/dashboard/ProfessionalDashboard.tsx` e satélites.

**API:** `get-professional-morning-briefing`.

**Blocos**

1. **Hero** — saudação + agenda do dia (próximas sessões, atrasos).
2. **Pulse / KPIs** — sessões hoje, ocupação, pendências de evolução, recebido no mês (se financeiro).
3. **Semana** — carga da semana.
4. **Portfólio** — recorte da carteira.
5. **Feed da família** — check-ins recentes (`DashboardFamilyFeed`). Este bloco é ** fortíssimo acoplamento infantil**: a home do terapeuta é alimentada pelo diário do cuidador.

**Dashboard de clinic_admin:** pulso da equipe + atalhos (Pacientes, Novo profissional). API `get-clinic-dashboard`.

**Master:** placeholder.

## 7.3 Agenda

**Rotas:** `/calendar`, `/agenda`.  
**Container:** `FullCalendar`.  
**Visões:** Mês, Semana, Lista.

**Lógica**

- API de resumo: `get-monthly-summary`.
- Criar horário: `create-schedule` (`NewScheduleModal`).
- Ciclo: `start-schedule-session` → workspace de sessão → `complete-schedule-session` / aprovação da nota.
- Reagendar / cancelar: `reschedule-session`, `cancel-session` — disparam jobs SES (`reschedule_notice`, `cancel_notice`).
- Integração financeira: sessão da agenda pode virar item a classificar / cobrar (`financeiro-list-pending-sessions`).

A agenda em si é **genérica**. O que não é genérico é o e-mail (copy “responsável”, “criança”) e a classificação financeira pensada em sessão recorrente infantil.

## 7.4 Lista de pacientes

**Rotas:** `/patients`, `/patients/archive`.

**Filtros de diagnóstico na UI** (`PatientDiagnosisFilter`):

| value | Label | Match |
|---|---|---|
| `all` | Todos | — |
| `tea` | TEA / Autismo | substring `tea`, `autis` |
| `tdah` | TDAH | `tdah`, `atenção` |
| `anxiety` | Ansiedade / TOC | `ansied`, `toc` |
| `other` | Outros | resto |

**Não existe filtro “depressão”.** Diagnóstico é `string[]` livre (JSONB). O chip colorido (`DiagnosisChips`) só pinta TEA (azul), TDAH (âmbar), ansiedade/TOC (violeta). Qualquer outro quadro cai em cinza “Outros”.

Ações: Novo Paciente (paywall), arquivo, reativar, gerenciar vínculo familiar.

## 7.5 Prontuário do paciente

**Rota:** `/patients/:patientId/:tab`  
**Default:** `copilot`.

| Aba | id | O que é |
|---|---|---|
| Copiloto de IA | `copilot` | Chat streaming, thread persistente, salvar artefato |
| Histórico de Sessões | `overview` | Lista de notas, leitura, “Gravar sessão” |
| Check-ins | `checkins` | Calendário de humor/crise da família |
| Ficha Clínica | `clinical` | Anamnese + foto + anexos |
| Financeiro | `financeiro` | Contrato e ledger (se solo) |
| Documentos Salvos | `documents` | Artefatos da IA, PDF, visibilidade família |

**Header do prontuário:** Diário da família (modal), Gerar acesso família, Gerenciar vínculo, Gravar sessão.

Tudo no header que diz “família” é ponto de modernização.

### Ficha clínica — campos persistidos em `patients`

Identidade: `name`, `nome_social`, `birth_date`, `cpf_paciente` / `cpf_responsavel` + `nome_responsavel`, `foto_url`.

Clínico: `diagnoses[]`, `queixa_principal`, `medicamentos`, `acompanhamento_multi[]`, `clinical_observations`.

Família: `composicao_familiar`, `responsaveis`.

IA / perfil: `objetivos_terapeuticos`, `hiperfocos_interesses`, `informacoes_adicionais`, `escolaridade_ocupacao`.

Contato: `contact_scope` (`responsável` / `paciente` / `ambos`), e-mails e telefones dos dois lados.

Financeiro (tabelas `financeiro_*`, não só a ficha).

`hiperfocos_interesses` e `escolaridade_ocupacao` são **vocabulário de desenvolvimento infantil**. Em adulto, o equivalente seria ocupação, rede de apoio, gatilhos, histórico de humor — hoje não há schema para isso.

## 7.6 Copiloto

Há **duas superfícies**, um motor.

1. **Aba do prontuário** — `PatientCopilotChat` `surface='record'`.
2. **Workspace em tela cheia** — `/copilot` e `/copilot/:patientId`. Gate pede para escolher o paciente (filtro por diagnóstico). `surface='workspace'`.

**APIs:** `query-copilot` (stream), `get-copilot-thread`, `reset-copilot-thread`, `transcribe-copilot-audio`.

**Persistência:** `copilot_threads` (um ativo por profissional+paciente) e `copilot_messages`.

**Artefatos salváveis**

- `acao_recomendada`
- `resumo_proativo`
- `relatorio_sessao`

Podem ser tornados visíveis à família (`update-artifact-visibility`).

Paywall: cada envio conta interação de IA.

## 7.7 Sessão clínica (ditado + texto)

**Rota:** `/session/:patientId?scheduleId=`

**Workspace:** `ClinicalSessionWorkspace`

- Painel de áudio (`SessionAudioPanel`) → `upload-audio` → `process-audio`.
- Editor de anotações (`SessionNotesEditor` / TipTap) → `process-session-text` / `save-session-annotations`.
- Modos: `text` | `audio` | `combined`.
- Vertex devolve estrutura tipo SOAP / evolução.
- Humano **revisa e aprova** (`approve-session-note`) ou rejeita.
- Sem aprovação, a nota não vira verdade clínica compartilhada.

Este fluxo é **genérico e deve permanecer no núcleo**. O que muda na expansão é o *template* da nota (infantil vs. adulto) e o que se compartilha com quem.

## 7.8 Settings e assinatura

**Rota única:** `/settings` (todas as antigas `/assinatura`, `/billing` redirecionam).

Seções: Você (nome, especialidade, CRP, foto) · Consultório · Assinatura (plano, cota, upgrade, cancelar) · Notificações (`crisis_alerts_email`, `weekly_digest_email`, `ai_usage_alerts`) · Segurança (MFA, senha).

## 7.9 Landing pública

**Rota:** `/`. Marketing da tese infantil. Inclui jornada animada da semana (diário da família → hiperfoco → diário da mãe → fechamento → insight da IA), planos, FAQ, razão social SYNES TECH.

Qualquer expansão de público **obriga** a reescrever esta página ou a ramificá-la (landing genérica + landing do módulo infantil).

## 7.10 Ajuda

`/ajuda` — formulário público `contact-form` → SES para contato@ / contact@ / synestech.business@gmail.com.

---

# Parte VIII — Portal da família (visão detalhada)

Este é o segundo produto dentro do produto. Mobile-first, PWA, bottom nav.

## 8.1 Por que existe

A tese original: a criança não relata a semana; o cuidador relata. O portal é a **fonte de dados entre sessões**. Sem ele, o copiloto perde o “agora” e o terapeuta volta ao WhatsApp.

## 8.2 Shell

`FamilyLayout`: Diário · Calendário · Relatórios e Combinados · Ajuda.

Não há copiloto, financeiro, agenda de consultório nem settings de plano.

## 8.3 Como a família entra (jornada)

```
Terapeuta no prontuário
  → “Gerar acesso família”
  → generate-invite  (código 8 chars, 72h, relationship='responsável')
  → mostra código para copiar / passar no WhatsApp

Familiar novo
  → /family/register
  → digita código
  → preview-invite (público, rate-limited) mostra o NOME do paciente
  → só então o botão de criar conta habilita
  → register-family  (Identity Platform role=family + consume_invite)

Familiar já logado sem vínculo
  → /family/link  ou  /invite
  → link-family-account / validate-invite
```

**Regras de segurança do convite**

- Código de baixa cardinalidade + rate limit + preview (não revela demais além do primeiro nome).
- `consume_invite` é atômico.
- Família só enxerga paciente com `patient_family_links` + `status_vinculo=ativo`.
- Cooldown de 30 dias após desvínculo (`reactivation-cooldown`).

## 8.4 Diário (`/family/diary`)

**Handler:** `submit-diary`. Role `family` only.

**Campos**

| Campo | Tipo | UI |
|---|---|---|
| `entry_date` | data | query `?date=` |
| `mood_score` | 1–5 | 😢 Difícil … 😄 Ótimo |
| `sleep_quality` | 1–5 | Péssimo … Ótimo |
| `crisis_occurred` | bool | |
| `crisis_level` | número | se crise |
| `categories[]` | enum | Sono, Escola, Alimentação, Social, Agitação, Sensorial |
| `notes` | texto | |
| `audio_note_url` / `transcricao` | áudio | check-in por voz |

Múltiplas entradas por dia são permitidas.

**Áudio:** `FamilyDiaryAudioRecorder` → `process-family-audio` / `submit-family-audio-checkin` → Vertex extrai os mesmos campos → família confirma → grava.

**Efeito colateral:** crise ≥ 3 dispara `crisis_alerts` (trigger). Terapeuta vê no dashboard / check-ins. E-mail opcional `crisis_alerts_email`.

**Acoplamento infantil das categorias:** Escola, Agitação, Sensorial. Não há Humor persistente, Ansiedade, Sono de adulto, Ideação, Adesão a medicação, Trabalho, Relacionamento.

## 8.5 Calendário da família (`/family/calendar`)

API `get-family-calendar-status`: quais dias têm check-in, mood, crise. Modal do dia lê a entrada e oferece “registrar agora”.

É um calendário de **adesão do cuidador**, não a agenda de consultas (embora a família também veja próximas sessões em relatórios).

## 8.6 Relatórios e Combinados (`/family/agreements`)

Abas:

| id | Label | Fonte |
|---|---|---|
| `overview` | Visão Geral | `get-latest-agreements` — última sessão, pontos de atenção, sugestões, resumo, lista de combinados |
| `sessions` | Histórico de Sessões | só notas `approved` + `visivel_familia` |
| `documents` | Documentos Compartilhados | artefatos com visibilidade família |
| `clinical` | Ficha Clínica | recorte da anamnese (`get-family-clinical-record`) — inclui hiperfocos |

Combinados: `agreements` com toggle `pending`/`done` (`toggle-agreement`). É o “dever de casa” da família.

## 8.7 O que a família **não** vê

- Copiloto / raciocínio da IA
- Notas em draft
- Financeiro do consultório
- Dados de outros pacientes
- Configuração de plano Unithery

## 8.8 Lógica de construção (por que é assim)

1. **Fricção zero no mobile** — chips e emojis, não formulário clínico.
2. **Assíncrono** — a família preenche quando a crise acontece, não na véspera da sessão.
3. **Áudio como atalho de analfabetismo digital / cansaço**.
4. **Preview do convite** — erro de vínculo é incidente LGPD.
5. **O terapeuta continua o dono do que a família lê** (flag `visivel_familia`).

## 8.9 Implicação direta da expansão

“Portal família → portal do paciente” **não é rename**. São dois produtos:

| | Portal família (hoje) | Portal do paciente (futuro) |
|---|---|---|
| Usuário | Cuidador | O próprio paciente (adulto / adolescente) |
| Objetivo | Relatar a criança | Relatar a si |
| Campos | sono, escola, crise, sensorial | humor, ansiedade, sono, adesão, gatilhos… |
| Convite | terapeuta → responsável | terapeuta → paciente (e-mail próprio) |
| Menor de idade | faz sentido | exige responsável + consentimento |
| TEA infantil | faz sentido | complementar, não substituto |

O plano precisará decidir **quando mostrar qual portal** (e se os dois coexistem no mesmo paciente).

---

# Parte IX — Jornada de criação do paciente (detalhe)

Esta é a jornada mais importante para a modernização. Hoje ela **nasce criança + responsável + contrato financeiro**.

## 9.1 Entrada

Lista de pacientes → **Novo Paciente** → `PaywallProvider.interceptNewPatient`.

- Free sem cartão: no máximo **1** paciente ativo.
- Plano pago: até a cota (10 / 20 / 30 + módulos de +5).

Modal: `PatientCreateModal` (`StandardModal`).

## 9.2 Passo 0 — Identidade / CPF

Toggle:

- “Sim, possui CPF” → `own_cpf` + `cpf_paciente`
- “Não, usar dados do responsável” → `dependent` + `cpf_responsavel` + `nome_responsavel`

Lookup `verify-patient-cpf`:

- match único desvinculado → card de reativação;
- vários matches → picker;
- nenhum → segue o wizard.

Isso existe por **LGPD + anti-duplicidade + cooldown de 30 dias**, não por TEA. Serve para adulto também, mas o caminho “só responsável” é o default mental do produto infantil.

## 9.3 Wizard de 6 passos

Definido em `patient-anamnesis.types.ts` → `WIZARD_STEPS`.

### Passo 1 — Dados básicos

- Nome, nome social, data de nascimento, escolaridade/ocupação, diagnósticos (texto livre, placeholder `"TEA Nível 1, TDAH"`), foto.

`diagnoses` é **obrigatório** (≥1) no schema de `create-patient`. Não há taxonomia clínica. O terapeuta digita o que quiser.

### Passo 2 — Contexto clínico

- Queixa principal, medicamentos, acompanhamento multidisciplinar (chips), anexos (PDF/Word/TXT), observações.

Anexos são enviados **depois** do insert e entram na fila de extração + embedding (“Transcrevendo documentos…”).

### Passo 3 — Dinâmica familiar

- Composição familiar, responsáveis.

Passo inteiro pensado em criança. Em adulto, vira “rede de apoio” ou some.

### Passo 4 — Parametrização da IA

- Objetivos terapêuticos, **hiperfocos e interesses**, informações adicionais.

Este passo alimenta o system prompt do copiloto. Hiperfoco é vocabulário TEA/TDAH.

### Passo 5 — Contato

- Escopo: somente responsável / somente paciente / ambos.
- E-mail e telefone de cada lado.
- Usado pela fila SES de sessão (confirmação, 24h, cancelamento).

Já existe a semente de “o paciente tem contato próprio”. A UI e a copy ainda privilegiam o responsável.

### Passo 6 — Financeiro (obrigatório para solo)

Modelo + tipo de cobrança (avulso, pacote, social, mensal recorrente). Valores, vencimento, janelas de recorrência.

Se `needs_windows`, abre `RecurrenceWindowsModal` depois do save (encaixe na agenda).

## 9.4 Persistência

1. Overlay: Salvando → Atualizando → Transcrevendo documentos → Armazenando → Quase lá.
2. `create-patient` (Zod + paywall + insert `patients` + contrato `financeiro_*`).
3. Upload avatar e anexos.
4. Embeddings dos anexos (`patient_embeddings`, 768d, `patient_id` obrigatório).
5. Opcional: janelas de recorrência.

## 9.5 O que **não** existe na criação

- Tipo de perfil: criança / adolescente / adulto.
- Quem terá login: só família / só paciente / ambos.
- Consentimento do paciente adulto.
- Questionários específicos (PHQ-9, GAD-7, CARS, etc.).
- Onboarding por áudio do terapeuta (o áudio é da sessão e do diário, não do cadastro).
- Especialidade do caso (TO vs. psicólogo vs. fono) como switch de formulário.

## 9.6 O que precisa ser decidido na modernização (sem resposta aqui)

1. O passo 0 continua CPF-first?
2. O passo 3 (família) vira condicional?
3. Diagnóstico deixa de ser string livre e vira taxonomia + “módulo”?
4. Financeiro continua obrigatório no create ou vira depois?
5. Qual o default de portal a convidar no final do wizard?

---

# Parte X — Jornadas de uso

## 10.1 Semana típica do terapeuta solo (hoje)

1. Segunda: abre `/dashboard`, vê agenda do dia e o feed de check-ins da família.
2. Clica no paciente → aba Copiloto: “o que a semana trouxe?”. A IA sintetiza diário + última sessão.
3. Entra em `/session/:id` (ou pela agenda). Grava 8–15 min, anota, deixa a IA estruturar, lapida, aprova.
4. Marca o que a família pode ver. Cria combinados.
5. Financeiro: classifica a sessão ou deixa o motor de recorrência gerar a cobrança.
6. Se a cota de pacientes ou de IA estoura, o paywall abre o catálogo.

## 10.2 Semana típica da família (hoje)

1. Recebe o código. Cadastra. Vê o nome da criança no preview.
2. No celular, abre o diário. Em 30 segundos marca humor, sono, chips. Ou manda um áudio no carro.
3. Se houve crise, o terapeuta é alertado.
4. No dia da sessão, pode receber e-mail (se o contato estiver no passo 5).
5. Depois, vê o combinado (“rotina da manhã”) e marca como feito.

## 10.3 Jornada que **não existe** (e a expansão precisa nascer)

- Paciente adulto cria a própria conta.
- Paciente adulto preenche um diário de humor / ansiedade / adesão.
- Paciente adulto lê o que o terapeuta compartilhou, sem um “responsável”.
- Terapeuta escolhe, no cadastro, o **modo do caso** (infantil-família vs. clínico-adulto vs. misto).

## 10.4 Jornada de vínculo e arquivo

- Arquivar / desvincular: `manage-patient-link`, `status_vinculo=desvinculado`.
- Reativar: `reactivate-patient` + cooldown.
- Hard delete: fluxo separado, irreversível, com confirmação (`PatientHardDeleteConfirmModal`).
- Backup de vagas: `quantidade_backup_pacientes` (addon).

---

# Parte XI — Sistema de IA (como foi analisado e construído)

## 11.1 Decisão de provedor

O roadmap antigo citava Claude / GPT-4o / Whisper. **O código de produção usa só Vertex AI.**

| Função | Modelo / mecanismo |
|---|---|
| Chat e stream | `gemini-2.5-pro` |
| Embeddings | `gemini-embedding-001`, **768 dimensões**, L2-normalized |
| STT de sessão / diário / copiloto | `vertexAudioToStructured` (inlineData base64) — **sem Whisper** |
| Extração de PDF/Word | `vertexExtractDocumentText` |

Região: `us-central1`. Auth: service account do projeto GCP.

## 11.2 Por que essa arquitetura

1. Isolamento legal: um índice vetorial **por paciente**, nunca global.
2. Custo: 768d é mais barato que 1536d; a migration inicial 1536 foi abandonada.
3. Humano no loop: a IA rascunha; o terapeuta assina.
4. Superfície dupla (prontuário vs. workspace) com o mesmo motor, para não duplicar RAG.

## 11.3 Pipeline do `query-copilot`

1. Paywall de IA (`assertCanUseAiPaywall` → `check_ai_interaction_quota`).
2. Guardrail de input (injection, `[system]`, etc.).
3. Valida que o professional é dono do paciente.
4. Monta contexto: cadastro/anamnese + diários recentes + sessões recentes + **inventário completo de sessões** (contagem autoritativa).
5. Embedding da pergunta → RPC `search_patient_embeddings(p_patient_id, ...)` → rerank (similaridade + recência).
6. Mascara PII.
7. System instruction (`buildCopilotSystemInstruction`) — tom de colega clínico, cita fontes, proíbe medicamento e diagnóstico definitivo.
8. Stream para o FE.
9. Persiste user + assistant em `copilot_messages`.
10. Audit `ai.copilot_query`.

## 11.4 O que o prompt assume hoje

Trecho real da instrução:

> “Você é um Copiloto Clínico auxiliando um terapeuta. (…) Relatos recentes da **família** (…) Use ativamente o **diário familiar** (…) Ao redigir documentos para a **família**, assine com o nome e registro (…) Foque em: atividades terapêuticas, análise comportamental, estratégias de manejo…”

Ou seja: o modelo é **instruído no vocabulário de criança + cuidador + manejo comportamental**. Para depressão / ansiedade de adulto isso é o prompt errado (risco de tom, de ênfase e de omissão de risco).

Guardrail de medicamento é transversal e deve permanecer (a Unithery não é prontuário médico prescritor).

## 11.5 RAG de anexos

Upload → extração Vertex → chunking (`text-chunking.ts`) → embedding 768d → `patient_embeddings`. O copiloto só busca com `patient_id`.

## 11.6 Threads

Um thread ativo por `(professional_id, patient_id)`. Reset soft-deleta e abre outro. Impede misturar casos no workspace.

---

# Parte XII — Billing, planos e visão de preços

## 12.1 Fonte da verdade

`src/shared/lib/therapist-plans.ts` espelha a tabela `planos`. Landing, Settings, Paywall e Stripe leem esse catálogo.

## 12.2 Catálogo vigente (produção, 17/08/2026)

| Plano | Pacientes | Sessões/mês | Duração | Áudio min/mês | IA/mês | Mensal | Anual (12x) | Anual total |
|---|---|---|---|---|---|---|---|---|
| Free / Degustação | 1 | 4 | 50 min | 260 | 20 | R$ 0 | — | — |
| Standard | 10 | 40 | 60 min | 3.120 | 750 | R$ 237 | R$ 207 | R$ 2.484 |
| Advanced | 20 | 80 | 60 min | 6.240 | 1.500 | R$ 427 | R$ 377 | R$ 4.524 |
| Premium | 30 | 120 | 60 min | 9.360 | 2.250 | R$ 657 | R$ 577 | R$ 6.924 |

Fórmula do áudio: `sessões × duração × 1,30` (margem 30%).  
Sessões = `patientLimit × 4` (premissa de 4 sessões/paciente/mês).

**Módulos +5 pacientes**

| Módulo | Planos | Pacientes | Sessões | IA | Mensal |
|---|---|---|---|---|---|
| `modulo_sa` | Standard / Advanced | +5 | +20 | +375 | R$ 129,43 |
| `modulo_p` | Premium | +5 | +20 | +375 | R$ 106,32 |

## 12.3 O que o plano inclui na copy

Em todos os pagos: copiloto isolado, transcrição, anexos vetorizados, **diário familiar com áudios ilimitados**, portal da família.

O diário familiar **não é tarifado**. A IA do terapeuta é.

## 12.4 Motor Stripe

- Checkout: `create-stripe-checkout` (trial 14 dias quando configurado).
- Webhook: `stripe-webhook` provisiona `clinics` / `clinic_subscriptions`.
- Sync diário: `sync-stripe-subscriptions`.
- Cancelamento: `cancel-subscription`.
- Paywall FE: `get-paywall-state` + `PaywallProvider` (novo paciente e envio de IA).
- Bypass de QA: `process-checkout-bypass` (não é caminho de produção).

Preços Stripe test + live foram alinhados ao catálogo acima. Assinaturas antigas permanecem no price_id antigo até upgrade.

## 12.5 Implicação para a expansão

O preço de hoje subsidia **um portal extra (família) + áudio ilimitado da família**. Se o portal do paciente adulto for mais leve (sem áudio, ou com menos STT), a unidade de custo muda. Se os dois portais coexistirem no módulo infantil, o custo sobe. O plano de modernização precisa dizer se o módulo TEA é **upsell** (add-on) ou **incluso**.

---

# Parte XIII — Financeiro do consultório (ERP leve)

Módulo **separado** do billing da Unithery. É o caixa do terapeuta solo.

**Rota:** `/financeiro` (`financeOnly`: professional solo ou master).

| Aba | Função |
|---|---|
| Visão geral | KPIs e gráficos (`financeiro-get-dashboard`) |
| Receitas | Contas a receber, `RecordPaymentModal` |
| Despesas | Custos fixos / parcelados |
| Pacientes & planos | Contratos, sessão extra, editar dados |
| Extrato | `financeiro-list-transacoes` |
| Sessões a classificar | Sessões da agenda ainda sem lançamento |

Tabelas: `financeiro_planos_paciente`, `financeiro_transacoes`, `financeiro_saldos_pacientes`, `financeiro_sessoes_cobranca`, `financeiro_custos_recorrentes`, `financeiro_contrato_janelas`.

Motor de recorrência: `financeiro-process-recurrence`.  
Ledger do paciente também aparece na aba Financeiro do prontuário.

Este módulo é **genérico** (qualquer psicólogo cobra sessão). Deve ficar no núcleo.

---

# Parte XIV — Inventário técnico compacto

## 14.1 Rotas

Públicas: `/`, `/login`, `/register`, `/family/register`, `/ajuda`, `/forgot-password`, `/reset-password`, `/auth/confirm`.  
Terapeuta: `/dashboard`, `/patients`, `/patients/:id/:tab`, `/calendar`, `/copilot`, `/session/:id`, `/financeiro`, `/settings`, `/professionals`.  
Família: `/family/diary`, `/family/calendar`, `/family/agreements`, `/family/link`, `/invite`.

## 14.2 Backend

114 handlers Deno. Domínios: auth, patients, family, session, copilot, financeiro, stripe, email, storage, admin.

Shared críticos: `auth.ts`, `vertex.ts`, `copilot-thread.ts`, `paywall.ts`, `object-storage.ts`, `financeiro.ts`, `aws-ses.ts`, `session-email-*.ts`, `family-access.ts`.

## 14.3 Banco (grupos)

- Identidade: `clinics`, `clinic_settings`, `professionals`, `clinic_admins`, `platform_admins`
- Paciente/família: `patients`, `invites`, `patient_family_links`, `family_members`, `diary_entries`, `crisis_alerts`, `agreements`
- Clínica/IA: `therapist_schedule`, `session_notes`, `audio_*`, `patient_embeddings`, `ai_jobs`, `ai_usage_events`, `recomendacoes_salvas`, `copilot_threads`, `copilot_messages`, `patient_attachments`
- Billing: `planos`, `plan_addons`, `clinic_subscriptions`, `clinic_addons`, `invoices`
- Caixa: `financeiro_*`
- Ops: `session_email_jobs`, `push_subscriptions`, `audit_logs`, `rate_limits`

74 migrations versionadas em `supabase/migrations/`.

## 14.4 Qualidade

- Unit: Vitest (utils de landing, dashboard, financeiro, copilot, calendário, paywall).
- E2E: Playwright + axe-core.
- CI: GitHub Actions (lint, typecheck, unit, e2e, audit).
- Gate DBA: migration nova só “done” com apply remoto validado.

## 14.5 Estado de produção na data deste relatório

- FE: GCS/CDN com landing nova (jornada + SYNES TECH + CNPJ).
- API: 114 handlers, health 200.
- Cloud SQL: preços 237/427/657 e anuais 207/377/577; `copilot_threads` existe; `cancel_notice` no check de e-mail; `foto_url` em professionals/admins.
- Stripe: catálogo alinhado (assinaturas antigas ficam no preço velho).

---

# Parte XV — O que hoje é “de criança / TEA” vs. o que já é genérico

Esta seção é o coração do briefing de modernização. Classificação honesta do código atual.

## 15.1 Já é núcleo genérico (reaproveitar)

- Auth, tenant, roles, paywall, Stripe.
- Prontuário com abas, anexos, embeddings, isolamento.
- Agenda, sessão multimodal, aprovação humana, PDF.
- Copiloto com thread + RAG + guardrail de prescrição.
- Financeiro do consultório.
- Settings, MFA, fotos, e-mail transacional de sessão (o *motor*, não a copy).
- Infra GCP.

## 15.2 É módulo infantil / família / desenvolvimento (acoplado)

| Superfície | Acoplamento |
|---|---|
| Landing | “A criança não conta”, hiperfoco, diário da mãe, TEA/TDAH |
| Cadastro passo 3 | Dinâmica familiar obrigatória na jornada |
| Cadastro passo 4 | Campo `hiperfocos_interesses` |
| Diagnósticos UI | Filtros TEA / TDAH / Ansiedade-TOC / Outros — sem depressão, sem adulto |
| Portal inteiro | Nome, IA, rotas `/family/*`, role `family` |
| Diário | Escola, sensorial, agitação, crise |
| Dashboard | `DashboardFamilyFeed` |
| Prontuário header | Gerar acesso família, modal diário da família |
| Aba Check-ins | Calendário de crise familiar |
| Prompt do copiloto | “relatos da família”, “documentos para a família”, manejo comportamental |
| Planos / features | “Diário familiar com áudios ilimitados”, “Portal da família incluso” |
| FAQ / why | Copy 100% infantil |
| E-mails de sessão | Destinatário pensado como responsável (`session-email-recipients`) |

## 15.3 É híbrido (genérico com cheiro infantil)

- `contact_scope` já prevê e-mail do paciente — copy e default são de responsável.
- `escolaridade_ocupacao` serve aos dois, label puxa escola.
- Ansiedade/TOC já tem cor de chip, mas o diário não tem dimensão de ansiedade.
- Clínica corporativa está no backend e desligada no launch.

## 15.4 Não existe e será necessário para “qualquer psicólogo”

- Tipo de caso / módulo no paciente (`child_family` vs `adult_self` vs `adolescent_shared`).
- Role `patient` (hoje só `family`).
- Portal do paciente (humor, tarefas, documentos, próxima sessão).
- Diários configuráveis por módulo (schema de categorias não é pluggable).
- Taxonomia de condição que troca UI e prompt.
- Instrumentos (PHQ-9, GAD-7, etc.).
- Fluxo de risco (ideação) — o guardrail atual evita diagnóstico/remédio, mas não há protocolo de emergência para adulto.
- Landing e onboarding ramificados.
- Precificação do módulo especial TEA.

---

# Parte XVI — Briefing para o plano de modernização

A IA / analista que receber este arquivo deve usar as seções acima como **fonte factual**. Abaixo, as perguntas que o plano precisa responder. Não estão decididas.

## 16.1 Princípio de produto sugerido (para debate, não decisão)

> **Núcleo Unithery** = terapeuta + prontuário + sessão + IA isolada + agenda + financeiro + billing.  
> **Módulo Desenvolvimento Infantil / TEA** = portal da família + diário de rotina + hiperfocos + check-ins de crise + copy e prompts atuais.  
> **Módulo Clínico Adulto** (novo) = portal do paciente + diário de si + campos e prompts de humor/ansiedade/depressão.

O módulo infantil **não some**. Ele deixa de ser o único caminho.

## 16.2 Cadastro do paciente — o que provavelmente muda

Perguntas obrigatórias no wizard (conceituais):

1. **Quem é o paciente?** Criança / adolescente / adulto.
2. **Quem acessa o segundo app?** Responsável, o próprio paciente, ambos, ninguém (só terapeuta).
3. **Qual módulo clínico?** Desenvolvimento (TEA/TDAH/etc.), clínico geral (ansiedade, depressão, TOC…), ou misto.
4. Em seguida, os passos atuais se **ligam ou desligam**:
   - Criança + responsável → passos 3 e 4 atuais + convite família.
   - Adulto + self-service → some dinâmica familiar; contato do paciente vira obrigatório; convite vai para o paciente.
   - Adolescente → os dois portais, com consentimento.

O passo financeiro e o CPF-first podem permanecer no núcleo.

## 16.3 Portal família → portal do paciente

| Decisão | Opções a analisar |
|---|---|
| Um app ou dois? | Mesmo PWA com shell diferente vs. rotas `/family` e `/me` |
| Role | Reusar `family` com outro label vs. criar `patient` |
| Convite | Mesmo `preview-invite` (mostrar nome) vs. magic link por e-mail |
| Diário | Schema único com categorias pluggable vs. tabelas por módulo |
| Visibilidade | Continuar `visivel_familia` generalizado para `visivel_portal` |
| Coexistência | Criança TEA: só família. Adulto: só paciente. Adolescente: ambos |

## 16.4 O que muda nas visões por condição

### Terapeuta — criança TEA/TDAH (módulo especial, quase o que existe)

- Feed da família, check-ins, hiperfoco, sensorial, escola.
- Copiloto com prompt de manejo e rotina.
- Header “acesso família”.

### Terapeuta — adulto ansiedade / depressão (núcleo + módulo clínico)

- Sem feed escolar/sensorial.
- Diário de humor / sono / adesão / crises de pânico (não “crise sensorial”).
- Copiloto com prompt de psicoterapia (não “atividades para a criança”).
- Header “acesso do paciente”.
- Chip e filtro “Depressão” / “Ansiedade” de primeira classe.
- **Risco:** o plano precisa prever o que a IA faz (e o que a UI faz) com ideação. Hoje isso não está modelado.

### Terapeuta — TDAH adulto

- Reusa parte do vocabulário (atenção, agitação) sem escola/hiperfoco infantil.
- Portal do paciente, não da mãe.

### Paciente / familiar — o que cada um vê

| Tela | Família (criança) | Paciente adulto |
|---|---|---|
| Home | Próxima sessão + humor da criança | Próxima sessão + meu humor |
| Diário | Rotina da criança | Meu estado |
| Documentos | O que o terapeuta liberou para os pais | O que liberou para mim |
| Combinados | Tarefa da casa / rotina | Tarefa terapêutica / registro |
| Ficha | Recorte para pais | Recorte para o paciente (mais restrito?) |

## 16.5 O que **não** deve quebrar

- Isolamento por `patient_id`.
- Aprovação humana da nota.
- Guardrail de medicamento / diagnóstico definitivo.
- Stripe e cotas.
- Financeiro solo.
- Contas e diários já existentes (migração: todo paciente atual = módulo infantil + portal família).

## 16.6 Ordem de análise recomendada para a outra IA

1. Definir a ontologia: `case_profile` + `portal_mode` + `clinical_module`.
2. Mapear cada tela desta Parte VII–X para “núcleo / infantil / adulto / condicional”.
3. Desenhar o wizard de criação novo, passo a passo, com defaults para a base já cadastrada.
4. Desenhar o portal do paciente como evolução do `FamilyLayout`, não como app separado na v1 (menor risco).
5. Parametrizar categorias de diário e system prompt por módulo.
6. Recortar landing e pricing (módulo TEA como feature flag / add-on).
7. Só então estimar esforço por fase (DBA → Backend → IA → Frontend → QA → Segurança).

## 16.7 Entregável esperado do plano

O plano de modernização deve devolver:

1. Visão de produto (núcleo + módulos).
2. Matriz tela × perfil (criança TEA, TDAH, adulto ansiedade, adulto depressão, adolescente).
3. Novo fluxo de criação de paciente (wireframe textual).
4. Modelo de dados delta (tabelas/colunas novas, o que reaproveita).
5. Mudanças de prompt e guardrail.
6. Impacto em billing (o módulo especial é incluso ou pago?).
7. Fases de entrega com o que vai para produção sem big-bang.
8. Riscos LGPD (menor de idade, portal do paciente, consentimento).

---

# Anexos

## A. Glossário do código

| Termo no código | Significado de produto |
|---|---|
| `family` | Role do cuidador |
| `is_solo` | Terapeuta dono do consultório |
| `clinic_id` | Tenant |
| `status_vinculo` | Paciente ativo ou desvinculado |
| `visivel_familia` | Terapeuta liberou o conteúdo para o portal |
| `diary_entries` | Check-in entre sessões |
| `recomendacoes_salvas` | Artefato de IA |
| `patient_embeddings` | Chunks vetoriais do caso |
| `financeiro_*` | Caixa do terapeuta, não a Unithery |
| `planos` | Catálogo SaaS |
| `session_email_jobs` | Fila SES da agenda |

## B. Arquivos âncora para a outra IA ler se precisar ir ao código

- Rotas: `src/app/routes.tsx`
- Planos: `src/shared/lib/therapist-plans.ts`
- Landing: `src/containers/landing/landing-content.ts`
- Wizard paciente: `src/containers/patient/patient-anamnesis.types.ts`
- Diário: `src/containers/family/RoutineDiary.tsx`
- Copiloto prompt: `supabase/functions/query-copilot/patient-context.ts`
- Vertex: `supabase/functions/_shared/vertex.ts`
- Auth API: `supabase/functions/_shared/auth.ts`
- Paywall: `supabase/functions/_shared/paywall.ts`
- Create patient: `supabase/functions/create-patient/schema.ts`
- Design: `identidade-visual.md`
- Roadmap histórico (desatualizado em IA/infra): `agente-contexto-roadmap.md`
- GCP: `infra/gcp/STATUS.md`, `docs/plano-migracao-supabase-vercel-gcp.md`

## C. Aviso sobre documentos antigos

Se a outra IA encontrar menção a Claude, Whisper, Vercel como FE de produção, 96 functions ou storage dual Supabase+GCS, **ignorar**. A fonte de verdade é este relatório + o código nas âncoras acima.

---

**Fim do relatório de estado atual.**  
Próximo passo combinado com o produto: enviar este arquivo à outra IA para o plano de modernização; em seguida, validar o plano neste repositório antes de implementar.
