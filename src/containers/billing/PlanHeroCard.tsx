import { planLabel } from '@features/billing/format';
import { THERAPIST_PLANS, formatBRL, isTherapistPlan } from '@shared/lib/therapist-plans';

interface PlanHeroCardProps {
  planId: string;
  isSolo: boolean;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  billingCycle?: 'monthly' | 'yearly';
  commitmentEndsAt?: string | null;
  hasStripeSubscription?: boolean;
  billingExempt?: boolean;
  onBrowsePlans?: () => void;
  onCancelPlan?: () => void;
}

function statusLabel(status: string, planId: string): string {
  if (planId === 'free') return 'Plano gratuito';
  if (status === 'trial_active') return 'Período gratuito (14 dias)';
  if (status === 'trialing') return 'Plano gratuito';
  if (status === 'active') return 'Assinatura ativa';
  if (status === 'past_due') return 'Pagamento pendente';
  if (status === 'canceled') return 'Assinatura cancelada';
  return 'Em avaliação';
}

function statusBadgeClass(status: string, planId: string): string {
  if (status === 'past_due') return 'bg-alert-bg text-alert';
  if (status === 'canceled') return 'bg-slate-100 text-charcoal-muted';
  if (planId === 'free' || status === 'trialing') return 'bg-ai-50 text-ai';
  return 'bg-mint-50 text-mint-dark';
}

export function PlanHeroCard({
  planId,
  isSolo,
  subscriptionStatus,
  trialEndsAt,
  billingCycle = 'monthly',
  commitmentEndsAt = null,
  hasStripeSubscription = false,
  billingExempt = false,
  onBrowsePlans,
  onCancelPlan,
}: PlanHeroCardProps) {
  const label = planLabel(planId, isSolo);
  const planDef = isTherapistPlan(planId) ? THERAPIST_PLANS[planId] : null;
  const isFree = planId === 'free';
  const inCommitment =
    billingCycle === 'yearly' && commitmentEndsAt !== null && new Date(commitmentEndsAt) > new Date();

  const priceLine = billingExempt
    ? 'Conta administrativa — sem cobrança ou limites de plano'
    : planDef
      ? isFree
        ? 'Grátis — sem cartão cadastrado'
        : billingCycle === 'yearly' && planDef.yearlyMonthlyCents
          ? `${formatBRL(planDef.yearlyMonthlyCents)}/mês · ciclo anual (12x com 12% off)`
          : `${formatBRL(planDef.monthlyCents)}/mês · ciclo mensal`
      : null;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm md:p-8">
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/5" />
      <div className="relative">
        <p className="text-xs font-medium uppercase tracking-wider text-charcoal-muted">Plano principal</p>
        <h2 className="mt-2 font-serif text-2xl font-medium tracking-tight text-charcoal md:text-3xl">
          {label}
        </h2>
        {priceLine && <p className="mt-1 text-sm text-charcoal-muted">{priceLine}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${billingExempt ? 'bg-slate-900 text-white' : statusBadgeClass(subscriptionStatus, planId)}`}
          >
            {billingExempt ? 'Conta administrativa' : statusLabel(subscriptionStatus, planId)}
          </span>
          {trialEndsAt && subscriptionStatus === 'trial_active' && (
            <span className="text-xs text-charcoal-muted">
              Grátis até {new Date(trialEndsAt).toLocaleDateString('pt-BR')} — cancele antes para não ser cobrado
            </span>
          )}
          {inCommitment && commitmentEndsAt && (
            <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-charcoal-muted">
              Compromisso anual até {new Date(commitmentEndsAt).toLocaleDateString('pt-BR')}
            </span>
          )}
        </div>
        <p className="mt-4 max-w-lg text-sm leading-relaxed text-charcoal-muted">
          {billingExempt
            ? 'Acesso administrativo da plataforma: sem paywall, sem cobrança Stripe e com cotas ilimitadas para operação e validação interna.'
            : isFree
              ? 'Você está no plano gratuito: 1 paciente ativo, 4 sessões/mês e 20 interações de IA. Assine um plano para ampliar sua carteira — os planos pagos começam com 14 dias grátis.'
              : isSolo
                ? 'Seu plano cobre pacientes ativos, sessões, IA clínica e recursos do consultório. Amplie a carteira com Módulos Adicionais de +5 pacientes quando precisar.'
                : 'Seu plano cobre pacientes ativos, IA clínica e recursos da clínica. Extensões de backup são contratadas separadamente abaixo.'}
        </p>
        {!billingExempt && (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {onBrowsePlans && (
              <button
                type="button"
                onClick={onBrowsePlans}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-primary/25 bg-primary-50 px-4 text-sm font-semibold text-primary transition-colors hover:border-primary/40 hover:bg-primary-100"
              >
                Ver todos os planos
              </button>
            )}
            {onCancelPlan && !isFree && hasStripeSubscription && (
              <button
                type="button"
                onClick={onCancelPlan}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-error/25 bg-white px-4 text-sm font-semibold text-error transition-colors hover:border-error/40 hover:bg-error-light/40"
              >
                Cancelar plano e revogar método de pagamento
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
