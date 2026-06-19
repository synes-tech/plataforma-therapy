import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoadingButton } from '@containers/loading';
import { callFunction } from '@shared/lib/api';
import { usePaywall } from '@containers/paywall';
import { UpgradePlanModal } from '@containers/billing/UpgradePlanModal';
import { useState } from 'react';
import {
  getReactivationCooldownStatus,
  type ReactivationCooldownStatus,
} from './patient-reactivation-cooldown.utils';
import { PatientReactivationCooldownBadge } from './PatientReactivationCooldownBadge';

interface PatientArchiveReactivateFlowProps {
  patientId: string;
  dataDesvinculacao: string | null;
}

export function PatientArchiveReactivateFlow({
  patientId,
  dataDesvinculacao,
}: PatientArchiveReactivateFlowProps) {
  const queryClient = useQueryClient();
  const { interceptNewPatient, refreshState } = usePaywall();
  const [actionError, setActionError] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState('');

  const cooldown: ReactivationCooldownStatus = getReactivationCooldownStatus(dataDesvinculacao);

  const mutation = useMutation({
    mutationFn: () => callFunction('reactivate-patient', { patient_id: patientId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archived-patients'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      refreshState();
      setActionError(null);
    },
    onError: (err: Error & { code?: string }) => {
      if (err.code === 'PAYMENT_REQUIRED' || err.code === 'QUOTA_EXCEEDED') {
        setUpgradeMessage(err.message);
        setUpgradeOpen(true);
        return;
      }
      setActionError(err.message);
    },
  });

  function handleReactivate() {
    if (!cooldown.canReactivate || mutation.isPending) return;
    setActionError(null);
    interceptNewPatient(() => mutation.mutate());
  }

  return (
    <>
      <PatientReactivationCooldownBadge status={cooldown} />

      <LoadingButton
        type="button"
        onClick={handleReactivate}
        loading={mutation.isPending}
        disabled={!cooldown.canReactivate}
        fullWidth
        className={`min-h-12 ${
          cooldown.canReactivate ? '' : 'cursor-not-allowed bg-slate-200 text-gray-500 opacity-50'
        }`}
      >
        Reativar
      </LoadingButton>

      {actionError && (
        <p role="alert" className="text-xs text-error">
          {actionError}
        </p>
      )}

      <UpgradePlanModal
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        message={upgradeMessage}
        ctaHref="/billing"
        ctaLabel="Ver plano"
      />
    </>
  );
}
