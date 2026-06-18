# Unithery — Tech Stack & Build System

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript (strict) + Vite + TailwindCSS + TanStack Query |
| PWA | vite-plugin-pwa (Workbox 7) + Service Workers |
| Backend | Supabase Edge Functions (Deno/TypeScript) |
| Database | PostgreSQL 15+ (Supabase managed) + pgvector + pgcrypto + pg_cron |
| Auth | Supabase Auth (GoTrue) + JWT RS256 + MFA |
| Storage | Supabase Storage (audio files + documents) |
| Realtime | Supabase Realtime (WebSockets) |
| AI - LLM | Claude Sonnet / GPT-4o (via API) |
| AI - STT | OpenAI Whisper API |
| AI - Embeddings | text-embedding-3-large (OpenAI) |
| AI - Vector DB | pgvector (native Supabase extension) |
| AI - Orchestration | LangChain.js or Vercel AI SDK (Deno-compatible) |
| Tests | Vitest + Playwright + K6 + axe-core |
| CI/CD | GitHub Actions |
| Monitoring | Supabase Dashboard + Helicone (LLM tracing) |

## Common Commands

```bash
# Supabase local development
supabase start                    # Start local Supabase (Docker)
supabase stop                     # Stop local Supabase
supabase db reset                 # Reset DB with migrations + seed

# Migrations
supabase migration new <name>     # Create new migration file
supabase db push                  # Apply migrations to remote

# Edge Functions
supabase functions serve <name>   # Local dev for a function
supabase functions deploy <name> --no-verify-jwt  # Deploy to production

# Secrets
supabase secrets set KEY=value    # Set environment secret
supabase secrets list             # List configured secrets

# Frontend
npm run dev                       # Vite dev server
npm run build                     # Production build
npm run preview                   # Preview production build
npm run lint                      # ESLint
npm run typecheck                 # TypeScript strict check

# Tests
npm run test:unit                 # Vitest unit tests
npm run test:integration          # Integration tests (requires local Supabase)
npm run test:e2e                  # Playwright E2E tests
npm run test:e2e -- --project=chromium  # E2E specific browser
```

## Key Conventions

### Backend (Edge Functions)
- Runtime: Deno (native to Supabase Edge Functions)
- Language: TypeScript strict mode (`strict: true`)
- Input validation: Zod schemas on every function entry point
- API response format: `{ success: boolean, data?: T, error?: { code: string, message: string }, meta?: { request_id, timestamp } }`
- Async processing: Heavy tasks (audio transcription, AI generation) use job queue pattern → return `202 Accepted` → notify via Realtime
- Secrets: Never hardcoded — always `Deno.env.get()`
- Logging: Structured JSON with `trace_id`, `function`, `user_id`, `clinic_id`, `action`, `duration_ms`

### Frontend
- State management: TanStack Query for server state; Zustand/Context for lightweight global UI state
- No Redux for remote data
- Components: Max 150 lines — decompose beyond that
- No `any` in TypeScript
- No `!important` in CSS
- No hardcoded colors outside theme tokens
- Typography in `rem`, not `px`
- Images: WebP/AVIF with `<picture>` tag and `loading="lazy"`
- Code splitting: `React.lazy()` + `Suspense` per route

### Database
- Primary keys: UUID (`gen_random_uuid()`), never sequential IDs
- All business tables have: `created_at`, `updated_at`, `created_by`, `deleted_at` (soft delete)
- RLS enabled on every business table — no exceptions
- Queries: Always parameterized, never string concatenation
- Connection: Always use pooled URL (PgBouncer), never direct connection from Edge Functions
- Vector search: Must always include `WHERE patient_id = $1` — no unfiltered queries

### Security
- JWT stored in `httpOnly` cookies with `Secure` + `SameSite=Strict` — never localStorage
- CORS: Never `*` in production
- Error responses: Never expose stack traces, SQL, or internal paths to client
- AI outputs: Always sanitized with DOMPurify before DOM insertion
- PII: Masked before sending to third-party LLMs (names → `[PACIENTE]`, CPF → removed)
