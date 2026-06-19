import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageLoader } from '@containers/loading';
import { usePaywall } from '@containers/paywall';
import { BackupAddonModal } from '@containers/billing/BackupAddonModal';
import { callFunction } from '@shared/lib/api';
import { resolveEffectivePlanQuotas } from '@shared/lib/plan-quota-limits';
import { PlanHeroCard } from '@containers/billing/PlanHeroCard';
import { PlanQuotaLimitRow, PlanQuotaRow } from './PlanQuotaRow';

interface ClinicSettingsPlanData {
  clinic: {
    subscription_plan: string;
    is_solo_professional: boolean;
  };
  quotas: {
    max_professionals: number;
    max_patients_per_professional: number;
    max_family_members_per_patient: number;
    max_ai_queries_per_month: number;
    max_audio_minutes_per_month: number;
  };
  ai_usage: {
    ai_reports_this_month: number;
    audio_minutes_this_month: number;
  };
  resource_usage: {
    professionals_count: number;
    active_patients_clinic_total: number;
    active_patients_owner_count: number;
    owner_is_professional: boolean;
    backup_licenses: number;
    backup_archived_count: number;
  };
}

interface PlanControlState {
  clinic: {
    subscription_plan: string;
    subscription_status: string;
    is_solo_professional: boolean;
    trial_ends_at: string | null;
  };
  backup: {
    quantidade_backup_pacientes: number;
    archived_count: number;
    pack_size: number;
    price_cents_per_pack: number;
  };
}

export default function SettingsPlanTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const { openPlansCatalog } = usePaywall();

  const { data, isLoading } = useQuery({
    queryKey: ['clinic-settings'],
    queryFn: () => callFunction<ClinicSettingsPlanData>('get-clinic-settings', {}),
    staleTime: 60_000,
  });

  const { data: planState } = useQuery({
    queryKey: ['plan-control-state'],
    queryFn: () => callFunction<PlanControlState>('get-plan-control-state', {}),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (searchParams.get('plans') !== '1') return;
    openPlansCatalog();
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('plans');
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams, openPlansCatalog]);

  if (isLoading && !data) {
    return <PageLoader label="Carregando plano e limites..." className="min-h-[40vh]" />;
  }

  const quotas = data?.quotas;
  const usage = data?.ai_usage;
  const resources = data?.resource_usage;
  const clinic = data?.clinic;
  const meta = planState?.clinic;
  const backup = planState?.backup;

  const effectiveQuotas = resolveEffectivePlanQuotas(
    meta?.subscription_plan ?? clinic?.subscription_plan ?? 'consultorio',
    quotas ?? {
      max_professionals: 0,
      max_patients_per_professional: 0,
      max_family_members_per_patient: 0,
      max_ai_queries_per_month: 0,
      max_audio_minutes_per_month: 0,
    },
  );

  const showOwnerPatients =
    Boolean(clinic?.is_solo_professional) || Boolean(resources?.owner_is_professional);

  const patientUsed = showOwnerPatients
    ? resources?.active_patients_owner_count ?? 0
    : resources?.active_patients_clinic_total ?? 0;

  const patientLabel = showOwnerPatients ? 'Pacientes ativos' : 'Pacientes ativos na clínica';
  const patientHint = showOwnerPatients
    ? 'Contagem dos pacientes com vínculo ativo no seu consultório.'
    : `Total na clínica · limite de ${effectiveQuotas.max_patients_per_professional ?? '—'} por profissional.`;

  const backupLicenses = backup?.quantidade_backup_pacientes ?? resources?.backup_licenses ?? 0;
  const backupArchived = backup?.archived_count ?? resources?.backup_archived_count ?? 0;

  return (
    <div className="flex w-full flex-col gap-6">
      {meta && (
        <PlanHeroCard
          planId={meta.subscription_plan}
          isSolo={meta.is_solo_professional}
          subscriptionStatus={meta.subscription_status}
          trialEndsAt={meta.trial_ends_at}
          onBrowsePlans={openPlansCatalog}
        />
      )}

      <section aria-labelledby="plan-limits-title">
        <h2 id="plan-limits-title" className="mb-3 font-display text-base font-semibold text-charcoal">
          Limites e uso do plano
        </h2>
        <div className="flex flex-col gap-2.5">
          <PlanQuotaRow
            label="Profissionais"
            used={resources?.professionals_count ?? 0}
            max={effectiveQuotas.max_professionals}
            hint="Terapeutas cadastrados na clínica ou consultório."
            onIncrease={openPlansCatalog}
          />
          <PlanQuotaRow
            label={patientLabel}
            used={patientUsed}
            max={showOwnerPatients ? effectiveQuotas.max_patients_per_professional : null}
            hint={patientHint}
            onIncrease={openPlansCatalog}
          />
          {!showOwnerPatients && effectiveQuotas.max_patients_per_professional && (
            <PlanQuotaLimitRow
              label="Limite por profissional"
              value={`até ${effectiveQuotas.max_patients_per_professional} pacientes`}
              hint="Cada terapeuta pode ter até esse número de pacientes ativos."
              onIncrease={openPlansCatalog}
            />
          )}
          {effectiveQuotas.max_family_members_per_patient && (
            <PlanQuotaLimitRow
              label="Familiares por paciente"
              value={`até ${effectiveQuotas.max_family_members_per_patient}`}
              hint="Responsáveis com acesso ao portal familiar por paciente."
              onIncrease={openPlansCatalog}
            />
          )}
          <PlanQuotaRow
            label="Relatórios de IA (mês)"
            used={usage?.ai_reports_this_month ?? 0}
            max={effectiveQuotas.max_ai_queries_per_month}
            hint="Gerações de relatório e consultas de IA no mês atual."
            onIncrease={openPlansCatalog}
          />
          <PlanQuotaRow
            label="Minutos de áudio (mês)"
            used={usage?.audio_minutes_this_month ?? 0}
            max={effectiveQuotas.max_audio_minutes_per_month}
            unit="min"
            hint="Gravações de sessão e ditados transcritos no mês."
            onIncrease={openPlansCatalog}
          />
          <PlanQuotaRow
            label="Arquivo clínico (backup)"
            used={backupArchived}
            max={backupLicenses > 0 ? backupLicenses : null}
            hint="Pacientes arquivados com licença de backup contratada."
            onIncrease={() => setBackupModalOpen(true)}
          />
        </div>
      </section>

      {backup && (
        <BackupAddonModal
          isOpen={backupModalOpen}
          onClose={() => setBackupModalOpen(false)}
          licenses={backup.quantidade_backup_pacientes}
          archivedCount={backup.archived_count}
          packSize={backup.pack_size}
          priceCentsPerPack={backup.price_cents_per_pack}
        />
      )}
    </div>
  );
}
