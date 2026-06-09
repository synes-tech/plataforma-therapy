# Therapy.AI — Identidade Visual & Design System

> Documento canônico da identidade visual implementada na plataforma.
> Substitui a referência histórica "dark High-Tech Minimal" do `agente-frontend.md`:
> a interface real evoluiu para um **High-Tech Minimal claro e clínico** (superfícies
> brancas sobre fundo off-white), mantendo sofisticação tecnológica com acolhimento.

## 1. Princípios
- **High-Tech Minimal claro:** fundo off-white `#F8FAF9`, superfícies brancas, sombras sutis.
- **Escaneabilidade:** alto contraste tipográfico, espaço bem gerido, zero poluição.
- **Consistência:** as telas conversam entre si (Login, Registro, Planos, Dashboard, Pacientes, Profissionais, Faturas, Configurações).
- **Mobile-first + PWA:** todo componente nasce responsivo (desktop e bottom sheet/cards no mobile).

## 2. Cores (tokens Tailwind — `tailwind.config.ts`)
| Token | Hex | Uso |
|---|---|---|
| `primary` | `#1A86E2` | CTAs primários, foco, links |
| `primary-50` | `#EBF5FE` | fundos suaves, avatares (profissionais) |
| `charcoal` | `#0F172A` | títulos e textos estruturais |
| `charcoal-muted` | `#475569` | textos secundários |
| `mint` / `mint-dark` | `#10B981` / `#059669` | status positivo / evolução |
| `ai` | `#7C3AED` | indicadores de IA |
| `alert` | `#F59E0B` | alertas de crise (âmbar) |
| `error` | `#EF4444` | erros / status vencido |
| Página | `#F8FAF9` | fundo padrão das telas internas |

**Chips de diagnóstico (`DiagnosisChips`):** TEA → azul (`blue-50/700`), TDAH → âmbar (`amber-50/700`), ansiedade/TOC → violeta (`ai`), demais → neutro (`slate`).

## 3. Tipografia
- **Serif (`font-serif`, Playfair Display):** títulos de página e de modais ("cuidado humano").
- **Display (`font-display`, Plus Jakarta Sans):** subtítulos/labels de seção.
- **Sans (`font-sans`, Inter):** corpo, inputs e botões.
- Tamanhos em `rem`; pesos: headings 500–600, body 400.

## 4. Componentes base
- **Surface:** `bg-white rounded-2xl border border-slate-100 shadow-sm`.
- **Listas:** superfície contínua com `divide-y divide-slate-100` no desktop; cards compactos no mobile.
- **Inputs:** `h-11 rounded-xl border border-slate-200 focus:border-primary/50 focus:ring-[3px] focus:ring-primary/10`.
- **Botão primário:** `bg-primary text-white rounded-xl hover:bg-primary-dark active:scale-[0.98]`.
- **Badges de status:** pílula `rounded-full` (Ativo→mint, Suspenso→error, demais→slate).

## 5. ⭐ StandardModal — PADRÃO ÚNICO DE MODAIS
**`src/shared/ui/StandardModal.tsx` é o componente OBRIGATÓRIO para todo formulário de
criação/edição e confirmações da plataforma.** Não criar formulários inline que empurram a
lista nem modais ad-hoc.

### Comportamento
- **Backdrop:** glassmorphism — `fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm`, clique fora fecha.
- **Desktop:** diálogo centralizado, `bg-white rounded-2xl shadow-2xl`, largura controlada (`md`/`lg`/`xl`), animação `scale-in`.
- **Mobile (< 768px):** **bottom sheet** colado à base (`rounded-t-3xl`), com "puxador" no topo, animação `slide-up`.
- **Header:** título serifado à esquerda + botão fechar (X) ghost à direita, divisor `border-b border-slate-100`.
- **Body:** `children` com scroll interno; grid `grid-cols-1 md:grid-cols-2` para campos lado a lado.
- **Footer:** `bg-slate-50` com ações à direita no desktop; no mobile `flex-col-reverse w-full` (primário em cima, "Cancelar" embaixo).
- **Acessibilidade:** `role="dialog"`, `aria-modal`, `aria-labelledby`, foco inicial, fechar com `Esc`, scroll do body bloqueado, `prefers-reduced-motion` respeitado.

### API
```tsx
<StandardModal isOpen={open} onClose={close} title="Cadastrar paciente" size="xl" footer={<>...botões...</>}>
  <form id="meu-form" onSubmit={...}>...campos...</form>
</StandardModal>
```
O botão de submit no footer referencia o form via atributo `form="meu-form"`.

### Adoção atual
- `/patients` — "Novo Paciente".
- `/professionals` — "Novo Profissional".
- **Próximas features devem reutilizar este componente** (novos cadastros, edições, confirmações destrutivas).

## 6. Animações (`tailwind.config.ts`)
`fade-in` (backdrop), `scale-in` (modal desktop), `slide-up` (bottom sheet mobile) — todas desativadas sob `prefers-reduced-motion`.
