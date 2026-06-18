import { planLabel } from '@features/billing/format';

interface PlanHeroCardProps {
  planId: string;
  isSolo: boolean;
  subscriptionStatus: string;
  trialEndsAt: string | null;
}

function statusLabel(status: string): string {
  if (status === 'trial_active' || status === 'trialing') return 'Trial ativo';
  if (status === 'active') return 'Assinatura ativa';
  return 'Em avaliação';
}

export function PlanHeroCard({ planId, isSolo, subscriptionStatus, trialEndsAt }: PlanHeroCardProps) {
  const label = planLabel(planId, isSolo);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm md:p-8">
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/5" />
      <div className="relative">
        <p className="text-xs font-medium uppercase tracking-wider text-charcoal-muted">Plano principal</p>
        <h2 className="mt-2 font-serif text-2xl font-medium tracking-tight text-charcoal md:text-3xl">
          {label}
        </h2>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full bg-mint-50 px-3 py-1 text-xs font-medium text-mint-dark">
            {statusLabel(subscriptionStatus)}
          </span>
          {trialEndsAt && (subscriptionStatus === 'trial_active' || subscriptionStatus === 'trialing') && (
            <span className="text-xs text-charcoal-muted">
              Trial até {new Date(trialEndsAt).toLocaleDateString('pt-BR')}
            </span>
          )}
        </div>
        <p className="mt-4 max-w-lg text-sm leading-relaxed text-charcoal-muted">
          Seu plano cobre pacientes ativos, IA clínica e recursos do consultório. Extensões de backup são
          contratadas separadamente abaixo.
        </p>
      </div>
    </section>
  );
}
