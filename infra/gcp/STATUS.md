# Status da migração GCP — staging

**Atualizado:** 2026-08-06  
**Produção FE:** cutover DNS feito → CDN GCP `https://unithery.com` (Vercel/Supabase ainda no ar para rollback API/DB legado)

## Concluído

| Fase | Item | Evidência |
|------|------|-----------|
| 0 | APIs, Artifact Registry, SA runtime | `unithery-docker`, `unithery-runtime@...` |
| 0 | Cloud SQL PG17 + pgvector 0.8.1 | `unithery-pg-staging` RUNNABLE |
| 0 | Buckets GCS staging (5 dados + FE) | PAP nos dados; FE público; + `unithery-profissionais-avatars-staging` |
| 1 | Dump/restore public + auth.users | counts: 35 patients, 36 users, 82 embeddings @ 768 dims |
| 1 | `auth.uid` / `auth.jwt` + 109 policies | `infra/gcp/sql/001_auth_compat.sql` |
| 3 | Cloud Run API Deno + PostgREST local | `unithery-api-staging` — **106/106 handlers** |
| 3 | REST → Cloud SQL | `GET /rest/v1/patients` → 200 |
| 3 | Function smoke | `preview-invite` → VALIDATION_ERROR esperado |
| 5 | FE build → GCS | `gs://unithery-fe-staging` HTTP 200 |
| 5 | Cloud CDN + HTTP/HTTPS LB | IP `136.69.93.249`; HTTP→HTTPS 301; cert map `unithery-fe-cert` (PROVISIONING) |
| 6 | Cloud Scheduler (3 jobs) | session-email, stripe-sync, reminders |
| 4 | Sync Storage → GCS (amostra/full) | script `04-sync-storage-to-gcs.mjs` — objetos espelhados nos 4 buckets staging |
| 4 | Signed URLs GCS (dual-read) | `STORAGE_BACKEND=dual`; helper `_shared/object-storage.ts`; EF `get-signed-read-url` |
| 4 | CORS buckets GCS (browser PUT/GET) | origins localhost + unithery.com + CDN IP |
| 5 | CDN HTTP | `http://136.69.93.249/` → HTML 200 |

## Híbrido atual (staging)

- **DB:** Cloud SQL (via PostgREST no mesmo container)
- **Auth:** Identity Platform (Firebase) no FE; JWT Firebase validado no Cloud Run; `/auth/v1` ainda proxy Supabase para legado
- **Storage:** dual — signed URL V4 GCS com fallback Supabase; proxy `/storage/v1` ainda disponível
- **FE data plane (Firebase):** `supabase-js` HTTP reescrito para `VITE_GCP_API_URL` (`src/shared/lib/supabase.ts`) — REST/Storage/Functions → Cloud Run/Cloud SQL
- **Realtime:** sem proxy no Cloud Run; watchers usam polling no plano GCP
- **FE staging:** GCS; API aponta para Cloud Run

## Auth Identity Platform (2026-08-06)

| Item | Status |
|------|--------|
| Email/senha | Ativado |
| Google IdP | Ativado |
| MFA SMS | `ENABLED` + `PHONE_SMS` (ajustado via API; estava DISABLED) |
| Import bcrypt | **36/36 users** com claims `role/clinic_id/is_solo` |
| FE botão Google | `LoginContainer` + Firebase SDK |
| Backend JWT Firebase | `_shared/auth.ts` (Cloud Run staging atualizado; Supabase: redeploy parcial por cota 100 fn) |

### Ação manual restante (Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client)

Authorized JavaScript origins:
- `http://localhost:5173`
- `https://unithery.com`
- `https://www.unithery.com`
- `https://plataforma-therapy-ai.firebaseapp.com`

Authorized redirect URIs:
- `https://unithery.com/__/auth/handler`
- `https://www.unithery.com/__/auth/handler`
- `https://plataforma-therapy-ai.firebaseapp.com/__/auth/handler`
- `http://localhost:5173`
- `https://unithery.com`
- `https://www.unithery.com`

O Google mostra “Prosseguir para …” com o `authDomain` do SDK. CDN faz proxy de `/__/auth/*` → Firebase (`firebase-auth-bs` + NEG). FE produção (2026-08-14): `VITE_FIREBASE_AUTH_DOMAIN=unithery.com` em `gs://unithery-fe-staging`.

Página pública `/ajuda` (Fale conosco) + Edge Function `contact-form` (SES → contato@, contact@, synestech.business@gmail.com). API rev `unithery-api-staging-00018-4tf`.

### MFA SMS — notas
- Plataforma OK (`PHONE_SMS` + locale `pt`).
- **UI enrollment:** Settings → Conta → `MfaSettingsSection` (ativar/desativar SMS; `RecaptchaVerifier` invisível).
- **Desafio no login:** `MfaSmsChallengeModal` para Google e e-mail Firebase (`auth/multi-factor-auth-required`).
- Login e-mail: tenta Firebase primeiro (quando `VITE_FIREBASE_*`); fallback Supabase se conta só no GoTrue.
- SMS Identity Platform gera custo; confirmar billing/SMS quota no projeto.
- Exige e-mail verificado na conta Firebase para enroll.

## URLs staging

| Recurso | URL |
|---------|-----|
| API | https://unithery-api-staging-708489350104.us-central1.run.app |
| FE GCS | https://storage.googleapis.com/unithery-fe-staging/index.html |
| FE CDN IP | http://136.69.93.249/ |
| Cloud SQL | `plataforma-therapy-ai:us-central1:unithery-pg-staging` |

## Storage signed URLs — smoke (2026-08-06)

| Check | Resultado |
|-------|-----------|
| Cloud Run rev | `unithery-api-staging-00009-wcr` — `STORAGE_BACKEND=dual` + 5 `GCS_BUCKET_*` |
| `POST /functions/v1/get-signed-read-url` (Firebase JWT) | 200 → URL `storage.googleapis.com` |
| GET áudio WAV assinado | 200 `audio/wav` (~326 KB) |
| GET avatar família | 200 `image/jpeg` `backend=gcs` |
| Dual-read (só Supabase) | 200 `backend=supabase` host `*.supabase.co` (fix: `SUPABASE_ORIGIN`) |
| Clínica errada | 403 FORBIDDEN |
| PUT/GET V4 smoke `_smoke/` | 200 |
| Handlers | 106/106 (incl. `get-signed-read-url`) |
| REST proxy PostgREST | **fix** strip `/rest/v1` → path local (`cloud-run/api/main.ts`) |

### Smoke E2E upload (2026-08-06)

| Fluxo | Resultado |
|-------|-----------|
| `upload-audio` → PUT GCS → `get-signed-read-url` → GET | 202 / 200 / 200 / 200 (44 bytes WAV) |
| `upload-patient-avatar` → PUT → confirm → read | 200 / 200 / 200 / 200 (PNG 70 bytes, `backend=gcs`) |
| `upload-patient-attachment` → PUT → read → confirm → delete | 200 em todos; GCS `backend=gcs`; conteúdo match; objeto removido após delete |
| `list-patient-attachments` | 200 (item `processing` pós-confirm) |
| `GET /rest/v1/patients` | 200 (regrediu a 404 antes do strip; corrigido) |

FE: `src/shared/lib/signed-read-url.ts` + players/avatars + `patient-attachment.api.ts`. Redeploy Supabase EF ainda limitado por cota (~100 fn); staging usa Cloud Run.

## Checklist QA FE → Cloud Run (automatizado 2026-08-06)

Script: `node infra/gcp/scripts/06-qa-staging-smoke.mjs` → **14/14 passed**

| # | Cenário | Resultado |
|---|---------|-----------|
| 1 | Health + Firebase JWT | 106 handlers; `joao@synes.tech` |
| 2 | REST patients/settings Cloud SQL | 200 (paciente do professional) |
| 3 | upload-audio → PUT GCS → `ai_jobs` | 202 / 200 / pending no Cloud SQL |
| 4 | signed read novo + existente | 200 `backend=gcs` |
| 5 | avatar PUT + confirm + read | 200 / 200 / gcs |
| 6 | anexo initiate→PUT→confirm→delete | 200; GCS limpo |
| 7 | MFA UI ready | `emailVerified=true` (36/36 contas) |
| 8 | IDP MFA SMS | `state=ENABLED` + `PHONE_SMS` |

### Também feito nesta rodada
- E-mails Identity Platform marcados `emailVerified=true` (necessário para enroll MFA)
- FE staging republished: `gs://unithery-fe-staging` + CDN `http://136.69.93.249/` → 200
- Build aponta `VITE_SUPABASE_URL` + `VITE_GCP_API_URL` → Cloud Run

## HTTPS CDN + cutover (2026-08-06)

### GCP pronto
| Item | Estado |
|------|--------|
| IP estático | `136.69.93.249` (`unithery-fe-staging-ip`) |
| HTTP FR | `unithery-fe-http-fr` EXTERNAL_MANAGED → redirect HTTPS 301 |
| HTTPS FR | `unithery-fe-https-fr` :443 + cert map |
| Cert Manager | `unithery-fe-cert` **ACTIVE** (`unithery.com` + `www`) · HTTPS 200 |
| SPA bucket | `index.html` como main + error page |
| FE build | aponta API Cloud Run |
| Identity authorizedDomains | inclui `unithery.com` / `www` |
| MFA SMS enroll manual | **adiado (PDS)** |

### Ação obrigatória — DNS na Hostinger (registrar atual)

Sem estes registros o certificado **não fica ACTIVE** e o HTTPS no domínio não sobe.

**Passo A — validação ACME (já agora):**
```
CNAME  _acme-challenge.unithery.com      →  4c0b31a9-76f8-4e74-acf0-646661b73d4c.2.authorize.certificatemanager.goog.
CNAME  _acme-challenge.www.unithery.com  →  ed3bc513-f176-4102-88d9-69e94ed86720.8.authorize.certificatemanager.goog.
```

**Passo B — cutover FE (após cert ACTIVE, ou com janela curta):**
```
A  @ (unithery.com)  →  136.69.93.249
A  www               →  136.69.93.249
```
Remover apontamentos Vercel antigos.

**Verificar:** `bash infra/gcp/scripts/07-cdn-https-cutover.sh`

**Passo C — Stripe (Dashboard, manual):**  
Webhook → `https://unithery-api-staging-708489350104.us-central1.run.app/functions/v1/stripe-webhook`

### Pós-DNS (automático / validar)
- `https://unithery.com` e `https://www.unithery.com` → FE GCS via CDN  
- Login Google / Firebase (domínios já autorizados)  
- API continua em `*.run.app` (HTTPS nativo)

## Próximos passos sugeridos

1. **Você:** criar CNAMEs ACME + A records na Hostinger  
2. Rodar `07-cdn-https-cutover.sh` até cert ACTIVE + HTTPS 200  
3. Stripe webhook cutover  
4. Observabilidade 72h; só então desligar Vercel/Supabase  
5. MFA SMS enroll (PDS)

## Não fazer ainda

- Desligar Supabase / Vercel (manter ~14 dias para rollback)  
- Cancelar projeto Supabase  

