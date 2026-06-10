import { useRef, useEffect } from 'react';
import { BRAND_LOGO_SRC } from '@shared/lib/brand-assets';

interface Plan {
  id: 'consultorio' | 'starter' | 'professional' | 'enterprise';
  name: string;
  description: string;
  highlight: string;
  features: string[];
  recommended?: boolean;
}

const PLANS: Plan[] = [
  {
    id: 'consultorio',
    name: 'Consultório',
    description: 'Para profissionais autônomos',
    highlight: 'Ideal para quem atende sozinho',
    features: [
      '1 profissional (você)',
      'Até 50 pacientes',
      'Copiloto de IA incluso',
      'Diário familiar integrado',
      'Relatórios automáticos por áudio',
    ],
  },
  {
    id: 'starter',
    name: 'Clínica Starter',
    description: 'Para clínicas pequenas',
    highlight: 'Até 3 profissionais',
    features: [
      'Até 3 profissionais',
      '30 pacientes por profissional',
      'Painel de gestão da clínica',
      'Copiloto de IA para todos',
      'Relatórios e métricas',
    ],
  },
  {
    id: 'professional',
    name: 'Clínica Pro',
    description: 'Para clínicas em crescimento',
    highlight: 'Até 10 profissionais',
    recommended: true,
    features: [
      'Até 10 profissionais',
      '50 pacientes por profissional',
      'Tudo do Starter +',
      'Prioridade no suporte',
      'Relatórios avançados',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'Plano personalizado',
    highlight: 'Sob medida para o seu cenário',
    features: [
      'Profissionais sob demanda',
      'Pacientes sob demanda',
      'Tudo do Pro +',
      'Gerente de conta dedicado',
      'API personalizada',
      'SLA e suporte prioritário',
    ],
  },
];

interface PlanSelectorProps {
  onSelect: (planId: Plan['id']) => void;
}

function CheckIcon() {
  return (
    <svg
      className="mt-px h-3 w-3 shrink-0 text-primary"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.5 8.5L6.5 11.5L12.5 4.5" />
    </svg>
  );
}

export function PlanSelector({ onSelect }: PlanSelectorProps) {
  const carouselRef = useRef<HTMLDivElement>(null);

  // No mobile, inicia no plano recomendado (index 2 = Clínica Pro)
  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;

    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      const cardWidth = el.scrollWidth / PLANS.length;
      el.scrollLeft = cardWidth * 2 - (window.innerWidth - cardWidth * 0.85) / 2;
    }
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden">
      {/* Fundo dividido: metade superior branca, metade inferior com cor pastel quente (mesma do lado esquerdo do login) */}
      <div className="absolute inset-0">
        <div className="h-1/2 bg-white" />
        <div
          className="h-1/2"
          style={{
            background:
              'linear-gradient(145deg, #FDF8F4 0%, #F5EDE8 30%, #EDE4DC 60%, #F8F0EB 100%)',
          }}
        />
      </div>
      {/* Desktop: Tudo centralizado verticalmente como um bloco único */}
      <section className="relative z-10 hidden flex-1 flex-col items-center justify-center px-6 md:flex">
        <img
          src={BRAND_LOGO_SRC}
          alt="Therapy.AI"
          className="mb-4 h-10 w-auto"
        />
        <h1 className="font-serif text-2xl font-medium tracking-tight text-charcoal">
          Escolha seu plano
        </h1>
        <p className="mt-1 text-sm text-charcoal-muted">
          O cuidado humano, escalado para a sua realidade clínica.
        </p>
        <div className="mt-24 grid w-full max-w-5xl grid-cols-4 gap-4">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onSelect={onSelect} />
          ))}
        </div>
        <p className="mt-24 text-xs text-charcoal-muted/50">
          Todos os planos incluem copiloto de IA e suporte por email. Upgrade disponível a qualquer momento.
        </p>
        <p className="mt-2 text-sm text-charcoal-muted">
          Já possui conta?{' '}
          <a
            href="/login"
            className="font-medium text-charcoal underline decoration-charcoal/30 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary/50"
          >
            Clique aqui para logar
          </a>
        </p>
      </section>

      {/* Mobile: Carrossel + footer agrupados no centro */}
      <section className="relative z-10 flex flex-1 flex-col items-center justify-center md:hidden">
        {/* Logo + título */}
        <img
          src={BRAND_LOGO_SRC}
          alt="Therapy.AI"
          className="mb-2 h-8 w-auto"
        />
        <h1 className="font-serif text-xl font-medium tracking-tight text-charcoal">
          Escolha seu plano
        </h1>
        <p className="mt-1 mb-16 text-xs text-charcoal-muted">
          O cuidado humano, escalado para a sua realidade clínica.
        </p>

        {/* Carrossel */}
        <div
          ref={carouselRef}
          className="flex w-full snap-x snap-mandatory gap-3 overflow-x-auto px-4 scrollbar-hide"
          style={{ scrollBehavior: 'smooth' }}
        >
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className="w-[78vw] flex-shrink-0 snap-center"
            >
              <PlanCard plan={plan} onSelect={onSelect} />
            </div>
          ))}
        </div>

        {/* Dots de paginação */}
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {PLANS.map((plan) => (
            <span
              key={plan.id}
              className={`h-1.5 rounded-full transition-all ${
                plan.recommended ? 'w-4 bg-primary' : 'w-1.5 bg-charcoal/15'
              }`}
            />
          ))}
        </div>

        {/* Textos de suporte */}
        <p className="mt-16 px-6 text-center text-[10px] text-charcoal-muted/50">
          Todos os planos incluem copiloto de IA e suporte por email. Upgrade disponível a qualquer momento.
        </p>
        <p className="mt-2 text-center text-xs text-charcoal-muted">
          Já possui conta?{' '}
          <a
            href="/login"
            className="font-medium text-charcoal underline decoration-charcoal/30 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary/50"
          >
            Clique aqui para logar
          </a>
        </p>
      </section>
    </div>
  );
}

function PlanCard({
  plan,
  onSelect,
}: {
  plan: Plan;
  onSelect: (planId: Plan['id']) => void;
}) {
  const isEnterprise = plan.id === 'enterprise';

  return (
    <div
      className="relative flex h-full flex-col overflow-visible rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft transition-all duration-200 hover:border-slate-300 hover:shadow-card lg:p-5"
    >
      {/* Plan header */}
      <div className="mb-3">
        <h3 className="font-display text-sm font-bold text-charcoal">
          {plan.name}
        </h3>
        <p className="mt-0.5 text-[11px] text-charcoal-muted">{plan.description}</p>
        <p className="mt-2 text-xs font-semibold text-charcoal">
          {plan.highlight}
        </p>
      </div>

      {/* Divider */}
      <div className="mb-3 h-px w-full bg-slate-100" />

      {/* Features list */}
      <ul className="flex-1 space-y-1.5">
        {plan.features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2 text-[11px] leading-tight text-charcoal-muted lg:text-xs">
            <CheckIcon />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      <button
        onClick={() => onSelect(plan.id)}
        className={`mt-4 h-9 w-full rounded-lg text-xs font-medium transition-all duration-200 lg:h-10 lg:rounded-xl ${
          isEnterprise
            ? 'border border-primary/30 bg-primary/5 text-primary hover:border-primary/50 hover:bg-primary/10 active:scale-[0.98]'
            : 'border border-slate-200 bg-white text-charcoal hover:border-charcoal/30 hover:bg-slate-50 active:scale-[0.98]'
        }`}
      >
        {isEnterprise ? 'Cotação para o seu cenário' : 'Selecionar'}
      </button>
    </div>
  );
}
