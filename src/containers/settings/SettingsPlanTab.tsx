import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageLoader } from '@containers/loading';
import { usePaywall } from '@containers/paywall';
import { BackupAddonModal } from '@containers/billing/BackupAddonModal';
import { PatientQuotaPackModal } from '@containers/billing/PatientQuotaPackModal';
import { CancelPlanModal } from '@containers/billing/CancelPlanModal';
import type { PlanControlState } from '@containers/billing/plan-control.types';
import { callFunction } from '@shared/lib/api';
import { resolveEffectivePlanQuotas } from '@shared/lib/plan-quota-limits';
import { effectivePatientLimit, isSoloSubscriptionPlan } from '@shared/lib/therapist-plans';
import { PlanHeroCard } from '@containers/billing/PlanHeroCard';
import { PlanQuotaLimitRow, PlanQuotaRow } from './PlanQuotaRow';

interface ClinicSettingsPlanData {
  clinic: {
    subscription_plan: string;
    is_solo_professional: boolean;
    billing_exempt?: boolean;
  };
  quotas: {
    max_professionals: number | null;
    max_patients_per_professional: number | null;
    max_family_members_per_patient: number | null;
    max_ai_queries_per_month: number | null;
    max_audio_minutes_per_month: number | null;
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
    patient_quota_bonus: number;
  };
}

export default function SettingsPlanTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [patientPackModalOpen, setPatientPackModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
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
  const billingExempt = meta?.billing_exempt === true || clinic?.billing_exempt === true;
  const backup = planState?.backup;
  const patientQuota = planState?.patient_quota;
  const consumption = planState?.usage;

  const effectiveQuotas = billingExempt
    ? {
        max_professionals: null,
        max_patients_per_professional: null,
        max_family_members_per_patient: null,
        max_ai_queries_per_month: null,
        max_audio_minutes_per_month: null,
      }
    : resolveEffectivePlanQuotas(
        meta?.subscription_plan ?? clinic?.subscription_plan ?? 'free',
        {
          max_professionals: quotas?.max_professionals ?? 0,
          max_patients_per_professional: quotas?.max_patients_per_professional ?? 0,
          max_family_members_per_patient: quotas?.max_family_members_per_patient ?? 0,
          max_ai_queries_per_month: quotas?.max_ai_queries_per_month ?? 0,
          max_audio_minutes_per_month: quotas?.max_audio_minutes_per_month ?? 0,
        },
      );

  const showOwnerPatients =
    Boolean(clinic?.is_solo_professional) || Boolean(resources?.owner_is_professional);

  const quotaBonus = patientQuota?.quota_bonus ?? resources?.patient_quota_bonus ?? 0;
  const patientMax = billingExempt
    ? null
    : showOwnerPatients
      ? effectivePatientLimit(effectiveQuotas.max_patients_per_professional, quotaBonus)
      : null;

  const patientUsed = showOwnerPatients
    ? patientQuota?.active_count ?? resources?.active_patients_owner_count ?? 0
    : resources?.active_patients_clinic_total ?? 0;

  const patientLabel = showOwnerPatients ? 'Pacientes ativos' : 'Pacientes ativos na clínica';
  const patientHint = showOwnerPatients
    ? quotaBonus > 0
      ? `Plano + ${quotaBonus} vagas extras via Módulos Adicionais.`
      : 'Contagem dos pacientes com vínculo ativo no seu consultório.'
    : `Total na clínica · limite de ${effectiveQuotas.max_patients_per_professional ?? '—'} por profissional.`;

  const isSoloPlan = isSoloSubscriptionPlan(meta?.subscription_plan ?? clinic?.subscription_plan ?? '');
  const openPatientIncrease = billingExempt
    ? undefined
    : () => {
        if (isSoloPlan && patientQuota?.addon) {
          setPatientPackModalOpen(true);
          return;
        }
        openPlansCatalog();
      };

  const backupLicenses = backup?.quantidade_backup_pacientes ?? resources?.backup_licenses ?? 0;
  const backupArchived = backup?.archived_count ?? resources?.backup_archived_count ?? 0;

  const sessionUsage = consumption?.sessions;
  const aiUsage = consumption?.ai;

  return (
    <div className="flex w-full flex-col gap-6">
      {meta && (
        <PlanHeroCard
          planId={meta.subscription_plan}
          isSolo={meta.is_solo_professional}
          subscriptionStatus={meta.subscription_status}
          trialEndsAt={meta.trial_ends_at}
          billingCycle={meta.billing_cycle}
          commitmentEndsAt={meta.commitment_ends_at}
          hasStripeSubscription={meta.has_stripe_subscription}
          billingExempt={billingExempt}
          onBrowsePlans={billingExempt ? undefined : openPlansCatalog}
          onCancelPlan={billingExempt ? undefined : () => setCancelModalOpen(true)}
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
            onIncrease={billingExempt ? undefined : openPlansCatalog}
          />
          <PlanQuotaRow
            label={patientLabel}
            used={patientUsed}
            max={showOwnerPatients ? patientMax : null}
            hint={billingExempt ? 'Conta administrativa — sem limite de pacientes.' : patientHint}
            onIncrease={openPatientIncrease}
          />
          {sessionUsage && !sessionUsage.unlimited && (
            <PlanQuotaRow
              label="Sessões agendadas (mês)"
              used={sessionUsage.total_used ?? 0}
              max={sessionUsage.total_limit}
              hint={`Limite total do plano (${sessionUsage.patient_recommended ?? 4} sessões recomendadas por paciente/mês).`}
              onIncrease={openPatientIncrease}
            />
          )}
          {aiUsage && !aiUsage.unlimited && (
            <PlanQuotaRow
              label="Interações de IA (mês)"
              used={aiUsage.used ?? 0}
              max={aiUsage.limit}
              hint="Conversas com o copiloto e recursos de IA no mês atual."
              onIncrease={openPatientIncrease}
            />
          )}
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
              hint="Responsáveis com acesso ao portal familiar — áudios do diário são ilimitados."
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
            hint="Gravações e transcrições de sessão no mês — limite proporcional às sessões do plano."
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

      {patientQuota && meta && (
        <PatientQuotaPackModal
          isOpen={patientPackModalOpen}
          onClose={() => setPatientPackModalOpen(false)}
          planBaseLimit={patientQuota.plan_base_limit}
          quotaBonus={patientQuota.quota_bonus}
          totalLimit={patientQuota.total_limit}
          activeCount={patientQuota.active_count}
          addon={patientQuota.addon}
          billingCycle={meta.billing_cycle}
          hasStripeSubscription={meta.has_stripe_subscription}
        />
      )}

      <CancelPlanModal isOpen={cancelModalOpen} onClose={() => setCancelModalOpen(false)} />
    </div>
  );
}
