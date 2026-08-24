import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@containers/layout';
import { usePaywall } from '@containers/paywall';
import { callFunction } from '@shared/lib/api';
import { useAuthStore } from '@shared/lib/auth-store';
import type { PlanControlState } from '@containers/billing/plan-control.types';
import { PatientListTabs } from './PatientListTabs';
import { PatientActiveListView } from './PatientActiveListView';
import { PatientArchiveListView } from './PatientArchiveListView';
import { PatientCreateModal } from './PatientCreateModal';
import { patientCreatedMessage } from './patient-created-message';
import { Toast } from './Toast';
import { PatientQuotaChip } from './PatientQuotaChip';
import { PatientCapacityModal } from './PatientCapacityModal';
import {
  clinicSettingsUsageFallback,
  resolvePatientQuotaForViewer,
  shouldShowPatientQuotaChip,
} from './patient-quota-chip.utils';
import type { PatientListTab } from './patient-archive.types';

export default function PatientListContainer() {
  const location = useLocation();
  const { interceptNewPatient, openPlansCatalog } = usePaywall();
  const user = useAuthStore((s) => s.user);
  const isAdminViewer = user?.role === 'clinic_admin' || user?.role === 'master';
  const [showCreate, setShowCreate] = useState(false);
  const [capacityOpen, setCapacityOpen] = useState(false);
  const [createdToast, setCreatedToast] = useState<ReturnType<typeof patientCreatedMessage> | null>(
    null,
  );

  const isArchive = location.pathname.startsWith('/patients/archive');
  const activeTab: PatientListTab = isArchive ? 'archive' : 'active';

  const planQuery = useQuery({
    queryKey: ['plan-control-state'],
    queryFn: () => callFunction<PlanControlState>('get-plan-control-state', {}),
  });

  const apiQuota = planQuery.data?.patient_quota ?? null;
  const needsAdminFallback = isAdminViewer && !shouldShowPatientQuotaChip(apiQuota?.total_limit);

  const settingsQuery = useQuery({
    queryKey: ['clinic-settings'],
    queryFn: () => callFunction('get-clinic-settings', {}),
    enabled: needsAdminFallback && planQuery.isSuccess,
  });

  const quota = resolvePatientQuotaForViewer({
    isAdminViewer,
    planId: planQuery.data?.clinic.subscription_plan,
    quota: apiQuota,
    settingsFallback: needsAdminFallback ? clinicSettingsUsageFallback(settingsQuery.data) : null,
  });
  const waitingAdminFallback = needsAdminFallback && settingsQuery.isPending;
  const showQuota = !waitingAdminFallback && shouldShowPatientQuotaChip(quota?.total_limit);

  function openCreateModal() {
    interceptNewPatient(() => setShowCreate(true));
  }

  function openCapacity() {
    setCapacityOpen(true);
  }

  function changePlanFromCapacity() {
    setCapacityOpen(false);
    openPlansCatalog();
  }

  return (
    <div className="bg-[#F8FAF9] px-4 sm:px-6 lg:px-8">
      <PageHeader
        title="Pacientes"
        subtitle={
          isArchive
            ? 'Histórico clínico arquivado — pacientes desvinculados da agenda ativa.'
            : 'Gerencie seus pacientes ativos e gere convites para familiares.'
        }
        actions={
          showQuota || !isArchive ? (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              {showQuota && quota ? (
                <PatientQuotaChip
                  activeCount={quota.active_count}
                  totalLimit={quota.total_limit}
                  onAmpliar={openCapacity}
                />
              ) : null}
              {!isArchive ? (
                <button
                  type="button"
                  data-tour="cta-new-patient"
                  onClick={openCreateModal}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-dark active:scale-[0.98] sm:w-auto lg:h-9 lg:px-4 lg:text-xs lg:font-semibold"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  Novo Paciente
                </button>
              ) : null}
            </div>
          ) : undefined
        }
        tabs={<PatientListTabs active={activeTab} />}
      />

      <div className="mt-6 pb-6 lg:mt-8 lg:pb-8">
        {isArchive ? (
          <PatientArchiveListView />
        ) : (
          <PatientActiveListView onOpenCreate={openCreateModal} />
        )}
      </div>

      <PatientCreateModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(summary) => setCreatedToast(patientCreatedMessage(summary))}
      />
      <Toast
        message={createdToast?.message ?? ''}
        variant={createdToast?.variant ?? 'success'}
        visible={Boolean(createdToast)}
        onDismiss={() => setCreatedToast(null)}
      />
      {quota && planQuery.data ? (
        <PatientCapacityModal
          isOpen={capacityOpen}
          onClose={() => setCapacityOpen(false)}
          quota={quota}
          planId={planQuery.data.clinic.subscription_plan}
          billingCycle={planQuery.data.clinic.billing_cycle}
          hasStripeSubscription={planQuery.data.clinic.has_stripe_subscription}
          onChangePlan={changePlanFromCapacity}
        />
      ) : null}
    </div>
  );
}
