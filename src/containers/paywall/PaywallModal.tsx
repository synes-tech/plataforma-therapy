import { useState } from 'react';
import { formatCurrency } from '@features/billing/format';
import { CheckoutForm } from '@containers/checkout';
import type { CheckoutFormData } from '@containers/checkout';
import type { PaywallBillingCycle, PaywallPlanCard, PaywallTrigger } from './paywall.types';

export type PaywallStep = 'plans' | 'checkout';

interface PaywallModalProps {
  isOpen: boolean;
  step: PaywallStep;
  onClose: () => void;
  trigger: PaywallTrigger;
  plans: PaywallPlanCard[];
  selectedPlan: PaywallPlanCard | null;
  trialEndsAt: string | null;
  trialUsed: boolean;
  stripeBillingEnabled?: boolean;
  onSelectPlan: (plan: PaywallPlanCard, cycle: PaywallBillingCycle) => void;
  onBackToPlans: () => void;
  onCheckoutSubmit: (data: CheckoutFormData) => void;
  checkoutSubmitting: boolean;
  checkoutError: string | null;
}

export function PaywallModal({
  isOpen,
  step,
  onClose,
  trigger,
  plans,
  selectedPlan,
  trialEndsAt,
  trialUsed,
  stripeBillingEnabled = false,
  onSelectPlan,
  onBackToPlans,
  onCheckoutSubmit,
  checkoutSubmitting,
  checkoutError,
}: PaywallModalProps) {
  const [cycle, setCycle] = useState<PaywallBillingCycle>('monthly');

  if (!isOpen) return null;

  const trialAvailable = !trialUsed;
  const trialHint = trialEndsAt
    ? `Seu período de teste termina em ${new Date(trialEndsAt).toLocaleDateString('pt-BR')}.`
    : trialAvailable
      ? '14 dias grátis em qualquer plano — cancele antes e não pague nada.'
      : 'Cobrança imediata (período gratuito já utilizado).';

  const priceForCycle = (plan: PaywallPlanCard): number =>
    cycle === 'yearly' && plan.preco_anual_mensal_cents
      ? plan.preco_anual_mensal_cents
      : plan.preco_mensal_cents;

  const gridCols = plans.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2';

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-charcoal/70 backdrop-blur-md"
        aria-label="Fechar paywall"
        onClick={checkoutSubmitting ? undefined : onClose}
        disabled={checkoutSubmitting}
      />

      <div className="relative z-10 max-h-[90dvh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-white/10 bg-gradient-to-b from-[#0f1419] via-[#121820] to-[#0a0d12] shadow-2xl shadow-black/50">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-ai/15 blur-3xl" />

        <button
          type="button"
          onClick={onClose}
          disabled={checkoutSubmitting}
          aria-label="Sair"
          className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-sm transition-colors hover:border-white/25 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50 md:right-5 md:top-5"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {step === 'checkout' && selectedPlan ? (
          <CheckoutForm
            plan={selectedPlan}
            isSubmitting={checkoutSubmitting}
            error={checkoutError}
            onSubmit={onCheckoutSubmit}
            onBack={onBackToPlans}
          />
        ) : (
          <>
            <div className="relative border-b border-white/10 px-6 py-8 text-center md:px-10">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/80">
                Unithery · Acesso completo
              </p>
              <h2 id="paywall-title" className="mt-3 font-serif text-2xl font-medium tracking-tight text-white md:text-3xl">
                {trigger === 'plan_catalog'
                  ? 'Escolha o plano ideal para você'
                  : 'Desbloqueie o poder total da Unithery'}
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-slate-400">
                {trigger === 'plan_catalog'
                  ? 'Compare os planos disponíveis e altere sua assinatura quando quiser.'
                  : trialAvailable
                    ? 'Comece com 14 dias grátis. Cadastre o cartão, não cobramos nada durante o teste.'
                    : 'Escolha seu plano e conclua o pagamento seguro via Stripe.'}
              </p>
              {trigger !== 'plan_catalog' && (
                <p className="mt-2 text-xs text-slate-500">{trialHint}</p>
              )}
              {trigger === 'patient_limit' && (
                <p className="mt-3 text-xs text-amber-400/90">
                  Seu plano FREE permite 1 paciente ativo. Assine para adicionar mais.
                </p>
              )}
              {trigger === 'ai_feature' && (
                <p className="mt-3 text-xs text-amber-400/90">
                  Você atingiu o limite de interações de IA do seu plano neste mês.
                </p>
              )}
              {checkoutError && step === 'plans' && (
                <p className="mt-3 text-xs text-red-400" role="alert">
                  {checkoutError}
                </p>
              )}

              <div className="mt-5 inline-flex items-center rounded-full border border-white/15 bg-white/5 p-1" role="tablist" aria-label="Ciclo de cobrança">
                <button
                  type="button"
                  role="tab"
                  aria-selected={cycle === 'monthly'}
                  onClick={() => setCycle('monthly')}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                    cycle === 'monthly' ? 'bg-white text-charcoal' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Mensal
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={cycle === 'yearly'}
                  onClick={() => setCycle('yearly')}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                    cycle === 'yearly' ? 'bg-white text-charcoal' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Anual · 12% off
                </button>
              </div>
            </div>

            <div className={`relative grid gap-4 p-6 md:p-8 ${gridCols}`}>
              {plans.map((plan) => {
                const monthlyEquivalent = priceForCycle(plan);
                return (
                  <article
                    key={plan.id}
                    className={`relative flex flex-col rounded-2xl border p-6 backdrop-blur-xl transition-transform hover:scale-[1.01] ${
                      plan.recomendado
                        ? 'border-primary/40 bg-white/10 shadow-[0_0_40px_rgba(13,148,136,0.15)]'
                        : 'border-white/10 bg-white/5'
                    }`}
                  >
                    {plan.recomendado && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                        Recomendado
                      </span>
                    )}

                    <h3 className="font-serif text-xl text-white">{plan.nome}</h3>
                    {plan.descricao_curta && (
                      <p className="mt-1 text-xs text-slate-400">{plan.descricao_curta}</p>
                    )}

                    <p className="mt-4 font-display text-3xl font-semibold text-white">
                      {formatCurrency(monthlyEquivalent)}
                      <span className="text-sm font-normal text-slate-500">/mês</span>
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {cycle === 'yearly'
                        ? `12x de ${formatCurrency(monthlyEquivalent)} no cartão · total ${formatCurrency(monthlyEquivalent * 12)}/ano`
                        : plan.preco_anual_mensal_cents
                          ? `ou ${formatCurrency(plan.preco_anual_mensal_cents)}/mês no anual`
                          : 'cobrança mensal recorrente'}
                    </p>

                    {plan.destaque && (
                      <p className="mt-2 text-xs font-medium text-white">{plan.destaque}</p>
                    )}

                    <ul className="mt-5 flex-1 space-y-2">
                      {plan.features.slice(0, 6).map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-xs text-slate-300">
                          <span className="mt-0.5 text-primary">✓</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      onClick={() => onSelectPlan(plan, cycle)}
                      disabled={checkoutSubmitting}
                      className={`mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold transition-all active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 ${
                        plan.recomendado
                          ? 'bg-primary text-white shadow-lg shadow-primary/30 hover:bg-primary-dark'
                          : 'border border-white/20 bg-white/10 text-white hover:bg-white/15'
                      }`}
                    >
                      {checkoutSubmitting && selectedPlan?.id === plan.id
                        ? 'Abrindo checkout…'
                        : trialAvailable && stripeBillingEnabled
                          ? 'Iniciar 14 dias grátis'
                          : trigger === 'plan_catalog'
                            ? 'Selecionar plano'
                            : 'Assinar plano'}
                    </button>
                  </article>
                );
              })}
            </div>

            <div className="relative border-t border-white/10 px-6 pb-2 pt-1 md:px-8">
              <div className="mx-auto max-w-2xl rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Como funciona a cobrança
                </p>
                <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-slate-400">
                  {trialAvailable ? (
                    <>
                      <li>
                        · Pediremos um cartão de crédito, mas <strong className="text-slate-300">nada será cobrado durante os 14 dias grátis</strong>.
                      </li>
                      <li>
                        · Após o período gratuito, a cobrança começa automaticamente no plano escolhido — a menos que você cancele antes.
                      </li>
                    </>
                  ) : (
                    <li>· A cobrança do plano escolhido é feita imediatamente no cartão cadastrado.</li>
                  )}
                  <li>
                    · Para cancelar: <strong className="text-slate-300">Configurações → Plano → Cancelar plano</strong>. O cancelamento revoga o método de pagamento e nenhuma nova cobrança é feita.
                  </li>
                  <li>
                    · No ciclo anual, o valor do ano é cobrado em 12 parcelas mensais com compromisso de 12 meses.
                  </li>
                </ul>
              </div>
            </div>

            <div className="relative px-6 py-4 text-center md:px-8">
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-slate-500 transition-colors hover:text-slate-300"
              >
                {trigger === 'plan_catalog' ? 'Fechar' : 'Continuar explorando depois'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
