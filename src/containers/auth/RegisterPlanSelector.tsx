import { useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SkeletonBlock } from '@containers/loading';
import { supabase } from '@shared/lib/supabase';
import { BRAND_LOGO_SRC } from '@shared/lib/brand-assets';
import type { AccountType } from '@features/register/account-type';
import type { PlanId } from '@features/register/constants';
import { isSoloPlan } from '@features/register/constants';
import {
  formatPlanoPriceLabel,
  type PlanoCatalogItem,
} from '@shared/lib/planos';

interface RegisterPlanSelectorProps {
  accountType: AccountType;
  onSelect: (planId: PlanId) => void;
  onBack?: () => void;
}

async function fetchPlanos(): Promise<PlanoCatalogItem[]> {
  const { data, error } = await supabase
    .from('planos')
    .select(
      'id, nome, tipo_perfil, preco_mensal_cents, limite_profissionais, limite_pacientes_por_prof, descricao_curta, destaque, features, recomendado, sort_order',
    )
    .eq('ativo', true)
    .order('sort_order');

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id as PlanId,
    nome: row.nome,
    tipo_perfil: row.tipo_perfil as 'autonomo' | 'clinica',
    preco_mensal_cents: row.preco_mensal_cents,
    limite_profissionais: row.limite_profissionais,
    limite_pacientes_por_prof: row.limite_pacientes_por_prof,
    descricao_curta: row.descricao_curta,
    destaque: row.destaque,
    features: Array.isArray(row.features) ? (row.features as string[]) : [],
    recomendado: row.recomendado,
    sort_order: row.sort_order,
  }));
}

function filterByAccountType(plans: PlanoCatalogItem[], accountType: AccountType) {
  if (accountType === 'solo') {
    return plans.filter((p) => p.tipo_perfil === 'autonomo' || isSoloPlan(p.id));
  }
  return plans.filter((p) => p.tipo_perfil === 'clinica' && !isSoloPlan(p.id));
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

export default function RegisterPlanSelector({
  accountType,
  onSelect,
  onBack,
}: RegisterPlanSelectorProps) {
  const carouselRef = useRef<HTMLDivElement>(null);

  const { data: allPlans, isLoading, error } = useQuery({
    queryKey: ['planos-catalog'],
    queryFn: fetchPlanos,
    staleTime: 5 * 60_000,
  });

  const visiblePlans = filterByAccountType(allPlans ?? [], accountType);
  const recommendedIndex = visiblePlans.findIndex((p) => p.recomendado);
  const scrollIndex = recommendedIndex >= 0 ? recommendedIndex : 0;

  useEffect(() => {
    const el = carouselRef.current;
    if (!el || visiblePlans.length <= 1) return;
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      const cardWidth = el.scrollWidth / visiblePlans.length;
      el.scrollLeft = cardWidth * scrollIndex - (window.innerWidth - cardWidth * 0.85) / 2;
    }
  }, [visiblePlans.length, scrollIndex]);

  const title = accountType === 'solo' ? 'Plano do consultório' : 'Planos para clínica';
  const subtitle =
    accountType === 'solo'
      ? 'Profissional independente com até 50 pacientes ativos.'
      : 'Escolha o plano que acompanha o crescimento da sua equipe.';

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden">
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

      <section className="relative z-10 hidden flex-1 flex-col items-center justify-center px-6 md:flex">
        <img src={BRAND_LOGO_SRC} alt="Unithery" className="mb-4 h-10 w-auto" />
        <h1 className="font-serif text-2xl font-medium tracking-tight text-charcoal">{title}</h1>
        <p className="mt-1 text-sm text-charcoal-muted">{subtitle}</p>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mt-3 text-xs font-medium text-charcoal-muted underline underline-offset-2 hover:text-charcoal"
          >
            ← Voltar ao tipo de conta
          </button>
        )}

        {error && (
          <p role="alert" className="mt-6 text-sm text-error">
            Não foi possível carregar os planos. Tente novamente.
          </p>
        )}

        {isLoading ? (
          <SkeletonBlock className="mt-24 h-48 w-full max-w-5xl rounded-2xl" />
        ) : (
          <div
            className={`mt-16 grid w-full max-w-5xl gap-4 ${
              visiblePlans.length === 1
                ? 'max-w-sm grid-cols-1'
                : visiblePlans.length === 3
                  ? 'grid-cols-3'
                  : 'grid-cols-4'
            }`}
          >
            {visiblePlans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} onSelect={onSelect} />
            ))}
          </div>
        )}
      </section>

      <section className="relative z-10 flex flex-1 flex-col items-center justify-center md:hidden">
        <img src={BRAND_LOGO_SRC} alt="Unithery" className="mb-2 h-8 w-auto" />
        <h1 className="font-serif text-xl font-medium tracking-tight text-charcoal">{title}</h1>
        <p className="mt-1 mb-12 px-6 text-center text-xs text-charcoal-muted">{subtitle}</p>
        {onBack && (
          <button type="button" onClick={onBack} className="mb-6 text-xs font-medium text-charcoal-muted underline">
            ← Voltar
          </button>
        )}

        <div
          ref={carouselRef}
          className="flex w-full snap-x snap-mandatory gap-3 overflow-x-auto px-4 scrollbar-hide"
        >
          {visiblePlans.map((plan) => (
            <div key={plan.id} className="w-[78vw] flex-shrink-0 snap-center">
              <PlanCard plan={plan} onSelect={onSelect} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PlanCard({
  plan,
  onSelect,
}: {
  plan: PlanoCatalogItem;
  onSelect: (planId: PlanId) => void;
}) {
  const isEnterprise = plan.id === 'enterprise';

  return (
    <div className="relative flex h-full flex-col overflow-visible rounded-2xl border border-slate-200/80 bg-white p-4 shadow-soft lg:p-5">
      {plan.recomendado && (
        <span className="absolute -top-2.5 right-3 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          Recomendado
        </span>
      )}
      <div className="mb-3">
        <h3 className="font-display text-sm font-bold text-charcoal">{plan.nome}</h3>
        <p className="mt-0.5 text-[11px] text-charcoal-muted">{plan.descricao_curta}</p>
        <p className="mt-2 font-display text-lg font-bold text-charcoal">
          {formatPlanoPriceLabel(plan.preco_mensal_cents)}
        </p>
        {plan.destaque && (
          <p className="mt-1 text-xs font-medium text-primary-dark">{plan.destaque}</p>
        )}
      </div>
      <div className="mb-3 h-px w-full bg-slate-100" />
      <ul className="flex-1 space-y-1.5">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-[11px] leading-tight text-charcoal-muted lg:text-xs">
            <CheckIcon />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => onSelect(plan.id)}
        className={`mt-4 h-9 w-full rounded-lg text-xs font-medium transition-all lg:h-10 lg:rounded-xl ${
          isEnterprise
            ? 'border border-primary/30 bg-primary/5 text-primary hover:border-primary/50 hover:bg-primary/10'
            : 'border border-slate-200 bg-white text-charcoal hover:border-charcoal/30 hover:bg-slate-50'
        }`}
      >
        {isEnterprise ? 'Falar com vendas' : 'Selecionar'}
      </button>
    </div>
  );
}
