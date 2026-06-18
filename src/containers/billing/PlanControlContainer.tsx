import { useQuery } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { PlanHeroCard } from './PlanHeroCard';
import { BackupAddonCard } from './BackupAddonCard';

interface PlanControlState {
  clinic: {
    id: string;
    subscription_plan: string;
    subscription_status: string;
    is_solo_professional: boolean;
    trial_ends_at: string | null;
    payment_method_on_file: boolean;
  };
  backup: {
    quantidade_backup_pacientes: number;
    archived_count: number;
    pack_size: number;
    price_cents_per_pack: number;
  };
}

export default function PlanControlContainer() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['plan-control-state'],
    queryFn: () => callFunction<PlanControlState>('get-plan-control-state', {}),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-56 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
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
      />

      <section aria-labelledby="extensions-title">
        <h2 id="extensions-title" className="mb-4 font-display text-base font-semibold text-charcoal">
          Extensões e Limites
        </h2>
        <BackupAddonCard
          licenses={data.backup.quantidade_backup_pacientes}
          archivedCount={data.backup.archived_count}
          packSize={data.backup.pack_size}
          priceCentsPerPack={data.backup.price_cents_per_pack}
        />
      </section>
    </div>
  );
}
