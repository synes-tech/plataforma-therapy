import { StandardModal } from '@shared/ui/StandardModal';
import { PatientQuotaPackPanel } from '@containers/billing/PatientQuotaPackPanel';
import { THERAPIST_PLANS, isTherapistPlan, patientUsagePercent } from '@shared/lib/therapist-plans';
import type { PlanControlState } from '@containers/billing/plan-control.types';
import { formatPatientQuotaLabel, patientQuotaModalHint, patientQuotaTone } from './patient-quota-chip.utils';

interface PatientCapacityModalProps {
  isOpen: boolean;
  onClose: () => void;
  quota: NonNullable<PlanControlState['patient_quota']>;
  planId: string;
  billingCycle: 'monthly' | 'yearly';
  hasStripeSubscription: boolean;
  onChangePlan: () => void;
}

export function PatientCapacityModal({
  isOpen,
  onClose,
  quota,
  planId,
  billingCycle,
  hasStripeSubscription,
  onChangePlan,
}: PatientCapacityModalProps) {
  const tone = patientQuotaTone(quota.active_count, quota.total_limit);
  const canBuyAddon = Boolean(quota.addon);
  const usage = patientUsagePercent(quota.active_count, quota.total_limit);
  const planName = isTherapistPlan(planId) ? THERAPIST_PLANS[planId].nome : 'seu plano';
  const barClass =
    tone === 'full' ? 'bg-error' : tone === 'warn' ? 'bg-amber-500' : 'bg-primary';

  return (
    <StandardModal isOpen={isOpen} onClose={onClose} title="Capacidade da carteira" size="xl">
      <div className="space-y-5">
        <div className="rounded-2xl border border-slate-100 bg-[#F8FAF9] p-4">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium text-charcoal">Pacientes ativos no {planName}</p>
            <p className="text-sm font-semibold tabular-nums text-charcoal">
              {formatPatientQuotaLabel(quota.active_count, quota.total_limit)}
            </p>
          </div>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200/80">
            <div className={`h-full rounded-full transition-all ${barClass}`} style={{ width: `${usage}%` }} />
          </div>
          <p className="mt-2 text-xs text-charcoal-muted">
            {quota.plan_base_limit} no plano
            {quota.quota_bonus > 0 ? ` · +${quota.quota_bonus} extras via módulos` : ''}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-charcoal">{patientQuotaModalHint(tone, canBuyAddon)}</p>
        </div>

        <button
          type="button"
          onClick={onChangePlan}
          className="flex w-full items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary-50/40"
        >
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-charcoal text-white">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 4v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="block font-display text-sm font-semibold text-charcoal">Mudar de plano</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-charcoal-muted">
              Compare Standard, Advanced e Premium e altere a assinatura. Mais pacientes entram no pacote.
            </span>
          </span>
        </button>

        {canBuyAddon ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="font-display text-sm font-semibold text-charcoal">Ou contrate um módulo extra</p>
            <p className="mt-1 text-xs text-charcoal-muted">
              Permanece no {planName} e soma +5 pacientes à cota, cobrados na assinatura atual.
            </p>
            <div className="mt-4">
              <PatientQuotaPackPanel
                planBaseLimit={quota.plan_base_limit}
                quotaBonus={quota.quota_bonus}
                totalLimit={quota.total_limit}
                activeCount={quota.active_count}
                addon={quota.addon}
                billingCycle={billingCycle}
                hasStripeSubscription={hasStripeSubscription}
                showUsageCard={false}
                onPurchaseSuccess={onClose}
              />
            </div>
          </div>
        ) : (
          <p className="text-xs text-charcoal-muted">
            Módulos de +5 pacientes estão nos planos Standard, Advanced e Premium.
          </p>
        )}
      </div>
    </StandardModal>
  );
}
