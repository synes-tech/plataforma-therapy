import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageLoader } from '@containers/loading';
import { callFunction } from '@shared/lib/api';
import { PlanHeroCard } from './PlanHeroCard';
import { BackupAddonCard } from './BackupAddonCard';
import { PatientQuotaPackCard } from './PatientQuotaPackCard';
import { CancelPlanModal } from './CancelPlanModal';
import type { PlanControlState } from './plan-control.types';

export default function PlanControlContainer({ onBrowsePlans }: { onBrowsePlans?: () => void }) {
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['plan-control-state'],
    queryFn: () => callFunction<PlanControlState>('get-plan-control-state', {}),
  });

  if (isLoading && !data) {
    return <PageLoader label="Carregando controle de plano..." className="min-h-[40vh]" />;
  }

  if (error || !data) {
    return (
      <div role="alert" className="rounded-xl border border-error/10 bg-error-light/50 px-4 py-3 text-sm text-error">
        Não foi possível carregar o controle de plano. Tente novamente.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PlanHeroCard
        planId={data.clinic.subscription_plan}
        isSolo={data.clinic.is_solo_professional}
        subscriptionStatus={data.clinic.subscription_status}
        trialEndsAt={data.clinic.trial_ends_at}
        billingCycle={data.clinic.billing_cycle}
        commitmentEndsAt={data.clinic.commitment_ends_at}
        hasStripeSubscription={data.clinic.has_stripe_subscription}
        billingExempt={data.clinic.billing_exempt === true}
        onBrowsePlans={onBrowsePlans}
        onCancelPlan={() => setCancelModalOpen(true)}
      />

      <section aria-labelledby="extensions-title">
        <h2 id="extensions-title" className="mb-4 font-display text-base font-semibold text-charcoal">
          Extensões e Limites
        </h2>
        <div className="space-y-4">
          {data.patient_quota && !data.clinic.billing_exempt && (
            <PatientQuotaPackCard
              planBaseLimit={data.patient_quota.plan_base_limit}
              quotaBonus={data.patient_quota.quota_bonus}
              totalLimit={data.patient_quota.total_limit}
              activeCount={data.patient_quota.active_count}
              addon={data.patient_quota.addon}
              billingCycle={data.clinic.billing_cycle}
              hasStripeSubscription={data.clinic.has_stripe_subscription}
            />
          )}
          <BackupAddonCard
            licenses={data.backup.quantidade_backup_pacientes}
            archivedCount={data.backup.archived_count}
            packSize={data.backup.pack_size}
            priceCentsPerPack={data.backup.price_cents_per_pack}
          />
        </div>
      </section>

      <CancelPlanModal isOpen={cancelModalOpen} onClose={() => setCancelModalOpen(false)} />
    </div>
  );
}
