# Therapy.AI — Project Structure

## Repository Layout (Target)

```
therapy-ai/
├── supabase/
│   ├── migrations/           # Versioned SQL migrations (YYYYMMDDHHMMSS_name.sql)
│   ├── seed.sql              # Development seed data
│   └── functions/
│       ├── _shared/          # Shared utilities across all Edge Functions
│       │   ├── auth.ts       # JWT validation middleware
│       │   ├── cors.ts       # Standardized CORS headers
│       │   ├── response.ts   # Formatted API response helper
│       │   ├── errors.ts     # Custom error classes
│       │   └── supabase.ts   # Client factory
│       ├── generate-invite/
│       │   ├── index.ts      # Handler (entry point)
│       │   ├── schema.ts     # Zod validation
│       │   ├── service.ts    # Business logic
│       │   └── types.ts      # Function-specific types
│       ├── validate-invite/
│       ├── create-patient/
│       ├── process-audio/
│       ├── query-copilot/
│       ├── submit-diary/
│       ├── upload-audio/
│       └── ...               # One directory per microservice
├── src/                      # Frontend (React + Vite)
│   ├── app/                  # Global config: providers, router, PWA registration
│   ├── containers/           # Routable views (NOT "pages")
│   │   ├── auth/             # Login, MFA, profile selection
│   │   ├── dashboard/        # Therapist main dashboard
│   │   ├── patient/          # Patient record, timeline, evolution
│   │   ├── copilot/          # AI copilot chat interface
│   │   ├── family/           # Family mobile views (diary, agreements)
│   │   └── admin/            # Master/Clinic admin panels
│   ├── features/             # Domain logic encapsulated by feature
│   │   ├── audio-recorder/   # Audio recording + waveform visualizer
│   │   ├── diary-form/       # Family diary submission components
│   │   ├── ai-chat/          # Copilot chat UI + streaming
│   │   └── invite-code/      # Invite generation + validation flow
│   ├── shared/               # Reusable across features
│   │   ├── ui/               # Atomic components (Button, Input, Card, Modal)
│   │   ├── hooks/            # Custom React hooks
│   │   ├── lib/              # Utility functions, API clients
│   │   └── types/            # Shared TypeScript types/interfaces
│   └── assets/               # Static assets (icons, fonts, images)
├── tests/
│   ├── unit/                 # Vitest unit tests
│   ├── integration/          # Integration tests (with local Supabase)
│   ├── e2e/                  # Playwright E2E tests
│   ├── fixtures/             # Test data factories
│   └── k6/                   # Load/performance test scripts
├── .github/
│   └── workflows/            # CI/CD pipeline definitions
├── public/                   # PWA manifest, icons, splash screens
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── .env.example              # Environment variable template (no secrets)
```

## Architecture Patterns

### Frontend: Feature-Sliced Design
- `containers/` = routable page-level components (entry points for routes)
- `features/` = self-contained domain modules with their own components, hooks, and logic
- `shared/` = truly reusable, feature-agnostic code (design system, utilities)
- No cross-imports between features — communicate via shared state or events

### Backend: Microservice per Edge Function
- Each Edge Function is an isolated microservice in its own directory
- Internal structure: `index.ts` (handler) → `schema.ts` (Zod) → `service.ts` (logic) → `types.ts`
- Shared code lives in `_shared/` (auth middleware, CORS, response formatting, error handling)
- Never import between function directories — only from `_shared/`

### Database: Shared Schema with RLS
- Single PostgreSQL database, single schema
- Multi-tenant isolation via Row Level Security policies
- Every query filtered by `clinic_id` from JWT claims
- Vector search (pgvector) always filtered by `patient_id` — enforced at RPC level
- Soft delete (`deleted_at`) on all clinical data — never physical deletion

## Naming Conventions
- **Files/directories:** kebab-case (`audio-recorder/`, `submit-diary/`)
- **React components:** PascalCase (`PatientCard.tsx`, `DiaryForm.tsx`)
- **Functions/variables:** camelCase (`getPatientTimeline`, `clinicId`)
- **Database tables:** snake_case (`patient_family_links`, `session_notes`)
- **Database columns:** snake_case (`created_at`, `clinic_id`)
- **API error codes:** UPPER_SNAKE_CASE (`QUOTA_EXCEEDED`, `INVITE_EXPIRED`)
- **Environment variables:** UPPER_SNAKE_CASE (`OPENAI_API_KEY`, `ENCRYPTION_KEY`)
