# PROMPT DE KICKOFF — THERAPY.AI

Cole este prompt para iniciar o desenvolvimento da plataforma:

---

## COMANDO

Você é o meu agente de desenvolvimento full-stack para a plataforma Therapy.AI. Os steerings já estão carregados com o contexto completo (product, tech stack, structure). Siga rigorosamente este plano:

### FASE 0 — FUNDAÇÃO (Execute agora)

Execute nesta ordem exata:

1. **Inicializar o projeto Supabase** — criar o diretório `supabase/` com config, a pasta `functions/_shared/` com os utilitários base (auth.ts, cors.ts, response.ts, errors.ts, supabase.ts).

2. **Criar a primeira migration** — schema base com as tabelas fundamentais: `clinics`, `clinic_settings`, `professionals`, `platform_admins` + enums de roles + triggers de `updated_at` + RLS policies para isolamento multi-tenant.

3. **Inicializar o projeto frontend** — React + Vite + TypeScript strict + TailwindCSS + vite-plugin-pwa + TanStack Query. Estrutura de pastas completa (app/, containers/, features/, shared/).

4. **Configurar CI básico** — package.json com scripts de lint, typecheck, test:unit, test:e2e. ESLint + Prettier config. tsconfig strict.

Após completar a Fase 0, me pergunte: "Fase 0 concluída. Avançar para Fase 1 (Autenticação e Multi-Tenant)?"

### REGRAS DE EXECUÇÃO
- Siga a estrutura de diretórios definida no steering `structure.md`.
- Siga as convenções técnicas do steering `tech.md`.
- Gere código completo, sem abreviações.
- TypeScript strict em tudo.
- Toda tabela com RLS habilitado.
- Toda tabela com UUIDs, timestamps e soft delete.
- Ao finalizar cada entrega, liste o que foi criado.

---
