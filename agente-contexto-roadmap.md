# CONTEXTO COMPLETO DA PLATAFORMA + ROADMAP DE EXECUÇÃO

## 1. VISÃO GERAL DO PRODUTO

### 1.1 O que é a Unithery
Um ecossistema digital SaaS com duas frentes integradas (Terapeuta e Família/Paciente) conectado a um Agente de IA Seguro e Especializado. A IA aprende o perfil único de cada paciente e atua como um copiloto clínico, sugerindo atividades personalizadas, analisando o comportamento reportado e automatizando relatórios.

### 1.2 Problema que Resolve
Clínicas e terapeutas autônomos gastam horas semanais cruzando dados manuais para criar relatórios e planejar sessões individualizadas. Profissionais recorrem a ferramentas genéricas (ChatGPT público) gerando riscos de conformidade, privacidade e falta de histórico unificado.

### 1.3 Público-Alvo
Clínicas de terapia multidisciplinar e terapeutas autônomos (Psicólogos, Psicopedagogos, Terapeutas Ocupacionais, Fonoaudiólogos). Foco inicial: público infantil (TEA e TDAH).

### 1.4 Diferenciais
* IA de Perfil Individualizado e Isolado por paciente.
* Onboarding Facilitado por Áudio (grava → transcreve → estrutura perfil).
* Copiloto de Sessão com Sugestão Dinâmica de Tarefas.
* **Apresentação clínica legível:** respostas e relatórios da IA são gerados em Markdown e exibidos formatados na UI (títulos, negrito, listas) — nunca como sintaxe crua.
* **Pré-visualização de convite:** ao digitar/colar o código de 8 caracteres no onboarding familiar, a plataforma exibe o **nome do paciente** vinculado antes de habilitar a confirmação final (previne vínculo errado).

---

## 2. HIERARQUIA DE USUÁRIOS (MULTI-TENANT)

```
┌─────────────────────────────────────────────────────────────────┐
│  CAMADA 1: MASTER (Nós — Donos da Plataforma SaaS)             │
│  • Gerencia todas as clínicas/consultórios cadastrados          │
│  • Define planos, limites e cobrança                            │
│  • Monitora métricas globais de uso                             │
│  • Controla features flags e rollouts                           │
├─────────────────────────────────────────────────────────────────┤
│  CAMADA 2A: CLÍNICA (Planos Starter/Pro/Enterprise)             │
│  • Cadastra e gerencia seus profissionais (colaboradores)       │
│  • Define limites: qtd pacientes por profissional               │
│  • Define limites: qtd familiares por paciente (1, 2 ou +)      │
│  • Visualiza relatórios agregados de produtividade              │
│  • Gerencia assinatura e billing                                │
├─────────────────────────────────────────────────────────────────┤
│  CAMADA 2B: CONSULTÓRIO (Plano Consultório — Solo)              │
│  • Profissional autônomo que atende sozinho                     │
│  • NÃO TEM tela de gestão de profissionais                     │
│  • Ao logar, vai direto para tela de PACIENTES                 │
│  • Limite padrão: 50 pacientes (extensível)                    │
│  • Mesmo copiloto IA e diário familiar                         │
├─────────────────────────────────────────────────────────────────┤
│  CAMADA 3: PROFISSIONAL (Terapeuta)                             │
│  • Cadastra pacientes (respeitando cotas)                       │
│  • Gera convites para familiares                                │
│  • Usa o Copiloto de IA (chat + sugestões + relatórios)         │
│  • Grava áudios e aprova relatórios                             │
├─────────────────────────────────────────────────────────────────┤
│  CAMADA 4: FAMÍLIA/PACIENTE                                     │
│  • Acessa via código de convite (gerado pelo profissional)      │
│  • Preenche diário de rotina semanal                            │
│  • Visualiza combinados e agenda                                │
│  • Acesso restrito APENAS ao seu paciente vinculado             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. STACK TECNOLÓGICO DEFINIDO

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React + TypeScript + Vite + TailwindCSS + TanStack Query |
| PWA | vite-plugin-pwa (Workbox 7) + Service Workers |
| Backend | Supabase Edge Functions (Deno/TypeScript) |
| Banco | PostgreSQL 15+ (Supabase managed) + pgvector + pgcrypto |
| Auth | Supabase Auth (GoTrue) + JWT RS256 + MFA |
| Storage | Supabase Storage (áudios + documentos) |
| Realtime | Supabase Realtime (WebSockets) |
| IA - LLM | Claude Sonnet / GPT-4o (via API) |
| IA - STT | OpenAI Whisper API |
| IA - Embeddings | text-embedding-3-large (OpenAI) |
| IA - Vector DB | pgvector (nativo Supabase) |
| Testes | Vitest + Playwright + K6 + axe-core |
| CI/CD | GitHub Actions |
| Monitoramento | Supabase Dashboard + Helicone (LLM) |

---

## 4. FUNCIONALIDADES POR FRENTE

### 4.1 Painel Master (SaaS Admin)
* Dashboard global: clínicas ativas, MRR, uso de IA.
* CRUD de clínicas + configuração de planos/limites.
* Feature flags e controle de rollout.
* Logs de auditoria globais.

### 4.2 Painel Clínica (Admin da Clínica)
* Dashboard: profissionais, pacientes ativos, uso de cota.
* Gestão de profissionais (convidar, desativar, definir limites).
* Configuração de limites por profissional.
* Relatórios de produtividade agregados.
* Gestão de assinatura/billing.

### 4.3 Visão Terapeuta (Web/Tablet)
* Login com MFA.
* Dashboard Central: agenda do dia + alertas de crise.
* Prontuário Inteligente: histórico + gráficos de evolução.
* Copiloto de IA: chat contextualizado + sugestão de atividades.
* Central de Áudio: gravação + transcrição + relatório SOAP.
* Gerador de Planos e Combinados (dispara para família).
* Gestão de pacientes + geração de convites.

### 4.4 Visão Família (Mobile/PWA)
* Acesso via código de convite.
* Home: humor da semana + próxima consulta.
* Diário de Rotina: emojis, sliders, chips rápidos.
* Agenda e Combinados: checklist interativo.

---

## 5. FLUXO DE VALOR (CICLO DA IA)

```
1. Família alimenta o Diário Semanal no PWA Mobile
                    ▼
2. Agente de IA cruza dados novos com Histórico Clínico isolado do Paciente
                    ▼
3. IA gera Insights e Sugestão de Tarefas para o Terapeuta antes da consulta
                    ▼
4. Terapeuta realiza a sessão focada e dita a evolução por áudio
                    ▼
5. Sistema transcreve, estrutura e gera o Relatório de Evolução (SOAP)
                    ▼
6. Terapeuta revisa e aprova → Base de dados isolada é atualizada
                    ▼
7. Novos embeddings gerados → Contexto do paciente enriquecido para próximo ciclo
```

---

## 6. ROADMAP DE EXECUÇÃO (FASES)

### FASE 0 — FUNDAÇÃO (Semanas 1-2)
**Objetivo:** Criar a infraestrutura base que todos os agentes utilizarão.

| # | Entrega | Agente Responsável | Dependência |
|---|---------|-------------------|-------------|
| 0.1 | Setup do projeto Supabase (projeto, migrations, env vars) | DBA (4) | Nenhuma |
| 0.2 | Schema base: auth, clinics, professionals, roles (DDL + RLS) | DBA (4) | 0.1 |
| 0.3 | Setup do projeto React + Vite + Tailwind + PWA + estrutura de pastas | Frontend (1) | Nenhuma |
| 0.4 | Configuração de CI/CD (lint, typecheck, test) | QA (5) | 0.3 |
| 0.5 | Edge Function base: _shared (auth, cors, response, errors) | Backend (2) | 0.1 |
| 0.6 | Análise de segurança da fundação (CSP, headers, RLS review) | Segurança (6) | 0.2, 0.5 |

---

### FASE 1 — AUTENTICAÇÃO E MULTI-TENANT (Semanas 3-4)
**Objetivo:** Login funcional para todos os perfis + hierarquia de acesso.

| # | Entrega | Agente Responsável | Dependência |
|---|---------|-------------------|-------------|
| 1.1 | Modelagem de tabelas: clinics, professionals, clinic_settings | DBA (4) | Fase 0 |
| 1.2 | Edge Functions: register-clinic, register-professional, login | Backend (2) | 1.1 |
| 1.3 | Custom JWT Claims (inject clinic_id + role no token) | Backend (2) | 1.2 |
| 1.4 | Tela de Login + Seleção de Perfil + MFA | Frontend (1) | 1.2 |
| 1.5 | Painel Master: CRUD de clínicas | Frontend (1) + Backend (2) | 1.3 |
| 1.6 | Painel Clínica: gestão de profissionais + cotas | Frontend (1) + Backend (2) | 1.3 |
| 1.7 | Testes de integração: RLS multi-tenant (MT-01 a MT-08) | QA (5) | 1.3 |
| 1.8 | Auditoria de segurança: auth flow + IDOR check | Segurança (6) | 1.7 |

---

### FASE 2 — GESTÃO DE PACIENTES E CONVITES (Semanas 5-6)
**Objetivo:** Profissional cadastra pacientes e gera convites para famílias.

| # | Entrega | Agente Responsável | Dependência |
|---|---------|-------------------|-------------|
| 2.1 | Modelagem: patients, patient_family_links, invites | DBA (4) | Fase 1 |
| 2.2 | Edge Functions: create-patient, generate-invite, validate-invite | Backend (2) | 2.1 |
| 2.3 | Lógica de cotas (profissional não excede limite da clínica) | Backend (2) | 2.2 |
| 2.4 | Tela: cadastro de paciente + prontuário básico | Frontend (1) | 2.2 |
| 2.5 | Tela: geração e cópia de convite | Frontend (1) | 2.2 |
| 2.6 | Fluxo mobile: inserir código de convite + vinculação | Frontend (1) | 2.2 |
| 2.7 | Testes E2E: fluxo completo onboarding → convite → vinculação | QA (5) | 2.6 |
| 2.8 | Segurança: brute-force de convite, timing attacks, entropia | Segurança (6) | 2.7 |

---

### FASE 3 — DIÁRIO DA FAMÍLIA + DASHBOARD DO TERAPEUTA (Semanas 7-8)
**Objetivo:** Família alimenta dados; terapeuta visualiza alertas.

| # | Entrega | Agente Responsável | Dependência |
|---|---------|-------------------|-------------|
| 3.1 | Modelagem: diary_entries, mood_logs + views materializadas | DBA (4) | Fase 2 |
| 3.2 | Edge Functions: submit-diary, get-patient-timeline, get-alerts | Backend (2) | 3.1 |
| 3.3 | Tela mobile: diário de rotina (emojis, sliders, chips) | Frontend (1) | 3.2 |
| 3.4 | Tela web: dashboard do terapeuta (agenda + alertas de crise) | Frontend (1) | 3.2 |
| 3.5 | Gráficos de evolução (view materializada → chart component) | Frontend (1) + DBA (4) | 3.1 |
| 3.6 | Realtime: notificação ao terapeuta quando família registra crise | Backend (2) | 3.2 |
| 3.7 | Testes: diário offline → sync + visual regression do dashboard | QA (5) | 3.4 |
| 3.8 | Segurança: RLS de diary_entries + validação de familiar | Segurança (6) | 3.7 |

---

### FASE 4 — MOTOR DE IA: TRANSCRIÇÃO E RELATÓRIO (Semanas 9-11)
**Objetivo:** Terapeuta grava áudio → IA transcreve → gera relatório SOAP.

| # | Entrega | Agente Responsável | Dependência |
|---|---------|-------------------|-------------|
| 4.1 | Modelagem: audio_transcriptions, session_notes (versionamento) | DBA (4) | Fase 3 |
| 4.2 | Setup pgvector: tabela embeddings + RPC search isolada | DBA (4) + IA (3) | 4.1 |
| 4.3 | Edge Function: upload-audio (Storage + job queue) | Backend (2) | 4.1 |
| 4.4 | Edge Function: process-audio (Whisper STT → LLM estruturação → SOAP) | IA (3) + Backend (2) | 4.3 |
| 4.5 | Pipeline de embeddings: chunking semântico + vetorização isolada | IA (3) | 4.2 |
| 4.6 | Tela: gravação de áudio + visualizer + status de processamento | Frontend (1) | 4.4 |
| 4.7 | Tela: revisão e aprovação de relatório (draft → approved) | Frontend (1) | 4.4 |
| 4.8 | Testes: transcrição E2E + teste de alucinação + contaminação | QA (5) | 4.7 |
| 4.9 | Segurança: anonimização PII para LLM + Storage access review | Segurança (6) | 4.8 |

---

### FASE 5 — COPILOTO DE IA (RAG + SUGESTÕES) (Semanas 12-14)
**Objetivo:** Copiloto funcional que sugere atividades baseadas no histórico isolado.

| # | Entrega | Agente Responsável | Dependência |
|---|---------|-------------------|-------------|
| 5.1 | Implementação RAG: hybrid search + metadata filtering + reranking | IA (3) | Fase 4 |
| 5.2 | Meta-prompts: copiloto de sessão (system/context/instruction/user) | IA (3) | 5.1 |
| 5.3 | Edge Function: query-copilot (orquestração RAG completa) | Backend (2) + IA (3) | 5.2 |
| 5.4 | Guardrails de input/output (prompt injection + output sanitization) | IA (3) + Segurança (6) | 5.3 |
| 5.5 | Tela: interface de chat do copiloto + painel de sugestões | Frontend (1) | 5.3 |
| 5.6 | Geração de combinados → dispatch para família | Backend (2) + Frontend (1) | 5.5 |
| 5.7 | Testes: contaminação cruzada, guardrails, alucinação, performance RAG | QA (5) | 5.6 |
| 5.8 | Segurança: pen test de prompt injection + data leakage review | Segurança (6) | 5.7 |

---

### FASE 6 — POLIMENTO, PERFORMANCE E COMPLIANCE (Semanas 15-16)
**Objetivo:** Hardening final para produção.

| # | Entrega | Agente Responsável | Dependência |
|---|---------|-------------------|-------------|
| 6.1 | Otimização de queries + índices baseados em query patterns reais | DBA (4) | Fase 5 |
| 6.2 | Performance frontend: Lighthouse 90+ em todas as telas | Frontend (1) | Fase 5 |
| 6.3 | Load testing: K6 com cenários de pico | QA (5) | 6.1 |
| 6.4 | Acessibilidade: axe-core completo + navegação por teclado | Frontend (1) + QA (5) | 6.2 |
| 6.5 | Audit trail completo + RIPD (Relatório de Impacto LGPD) | Segurança (6) | Fase 5 |
| 6.6 | Backup + PITR + teste de restore | DBA (4) | 6.1 |
| 6.7 | Pen test final (OWASP ZAP + manual) | Segurança (6) | 6.5 |
| 6.8 | Visual regression completa + smoke tests em 3 browsers | QA (5) | 6.2 |
| 6.9 | Documentação de API + Onboarding de clínicas | Backend (2) | Todos |

---

## 7. MAPA DE DEPENDÊNCIA ENTRE AGENTES

```
                    ┌──────────────┐
                    │  ORQUESTRADOR │  (Coordena a ordem de execução)
                    └──────┬───────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                  ▼
   ┌───────────┐    ┌───────────┐     ┌───────────┐
   │  DBA (4)  │    │ Backend(2)│     │Frontend(1)│
   │ (Schema)  │───▶│  (APIs)   │───▶ │  (Telas)  │
   └───────────┘    └───────────┘     └───────────┘
         │                 │                  │
         │          ┌──────┴───────┐          │
         │          ▼              ▼          │
         │    ┌───────────┐  ┌─────────┐     │
         │    │   IA (3)  │  │  QA (5) │◀────┘
         │    │(LLM/RAG)  │  │(Testes) │
         │    └───────────┘  └─────────┘
         │                        │
         │              ┌─────────┴─────────┐
         └──────────────▶  Segurança (6)    │
                        │  (Auditoria)      │
                        └───────────────────┘
```

**Regra de dependência:**
- DBA cria o schema → Backend consome o schema → Frontend consome as APIs.
- IA (3) depende de Backend (2) e DBA (4) para funcionar.
- QA (5) valida TUDO após cada fase (integração + E2E).
- Segurança (6) audita ao final de cada fase (gate de qualidade).

---

## 8. CRITÉRIOS DE TRANSIÇÃO ENTRE FASES

Uma fase só é considerada completa quando:
1. ✅ Todas as entregas da fase estão implementadas.
2. ✅ Testes de integração e E2E passam (QA aprovou).
3. ✅ Auditoria de segurança foi executada (Segurança aprovou).
4. ✅ Nenhuma vulnerabilidade CRÍTICA ou ALTA está aberta.
5. ✅ Code review feito (lint + typecheck passam sem erros).

---

## 9. MÉTRICAS DE SUCESSO POR FASE

| Fase | Métrica de Validação |
|------|---------------------|
| 0 | Projeto Supabase rodando local + React buildando + CI green |
| 1 | Login funcional para 4 perfis + RLS validado (0 bypass) |
| 2 | Fluxo convite E2E: gerar → consumir → vincular → acessar |
| 3 | Família submete diário → terapeuta vê alerta < 5s (Realtime) |
| 4 | Áudio de 3min → relatório SOAP em < 30s + zero alucinação |
| 5 | Copiloto sugere atividade citando fonte + 0 contaminação cruzada |
| 6 | Lighthouse 90+ / Load test SLA ok / Pen test sem Crítico/Alto |
