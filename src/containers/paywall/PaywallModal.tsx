import { formatCurrency } from '@features/billing/format';
import { CheckoutForm } from '@containers/checkout';
import type { CheckoutFormData } from '@containers/checkout';
import type { PaywallPlanCard, PaywallTrigger } from './paywall.types';

export type PaywallStep = 'plans' | 'checkout';

interface PaywallModalProps {
  isOpen: boolean;
  step: PaywallStep;
  onClose: () => void;
  trigger: PaywallTrigger;
  plans: PaywallPlanCard[];
  selectedPlan: PaywallPlanCard | null;
  trialEndsAt: string | null;
  onSelectPlan: (plan: PaywallPlanCard) => void;
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
  onSelectPlan,
  onBackToPlans,
  onCheckoutSubmit,
  checkoutSubmitting,
  checkoutError,
}: PaywallModalProps) {
  if (!isOpen) return null;

  const trialHint = trialEndsAt
    ? `Seu período de teste termina em ${new Date(trialEndsAt).toLocaleDateString('pt-BR')}.`
    : '14 dias grátis para explorar tudo.';

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

      <div className="relative z-10 max-h-[90dvh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-white/10 bg-gradient-to-b from-[#0f1419] via-[#121820] to-[#0a0d12] shadow-2xl shadow-black/50">
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
                  : 'Inicie seus 14 dias grátis agora. Cancele quando quiser.'}
              </p>
              {trigger !== 'plan_catalog' && (
                <p className="mt-2 text-xs text-slate-500">{trialHint}</p>
              )}
              {trigger === 'patient_limit' && (
                <p className="mt-3 text-xs text-amber-400/90">
                  Você já cadastrou seu paciente de degustação. Assine para adicionar mais.
                </p>
              )}
              {trigger === 'ai_feature' && (
                <p className="mt-3 text-xs text-amber-400/90">
                  A IA e o copiloto clínico exigem assinatura após o primeiro paciente.
                </p>
              )}
            </div>

            <div className="relative grid gap-4 p-6 md:grid-cols-2 md:p-8">
              {plans.map((plan) => (
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
                    {formatCurrency(plan.preco_mensal_cents)}
                    <span className="text-sm font-normal text-slate-500">/mês</span>
                  </p>

                  {plan.destaque && (
                    <p className="mt-2 text-xs font-medium text-white">{plan.destaque}</p>
                  )}

                  <ul className="mt-5 flex-1 space-y-2">
                    {plan.features.slice(0, 5).map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-xs text-slate-300">
                        <span className="mt-0.5 text-primary">✓</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() => onSelectPlan(plan)}
                    className={`mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
                      plan.recomendado
                        ? 'bg-primary text-white shadow-lg shadow-primary/30 hover:bg-primary-dark'
                        : 'border border-white/20 bg-white/10 text-white hover:bg-white/15'
                    }`}
                  >
                    {trigger === 'plan_catalog' ? 'Selecionar plano' : 'Iniciar 14 dias grátis'}
                  </button>
                </article>
              ))}
            </div>

            <div className="relative border-t border-white/10 px-6 py-4 text-center md:px-8">
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
