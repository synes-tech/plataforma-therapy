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
  compact?: boolean;
  className?: string;
}

export function PatientArchiveReactivateFlow({
  patientId,
  dataDesvinculacao,
  compact = false,
  className = '',
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
      {!compact ? <PatientReactivationCooldownBadge status={cooldown} /> : null}

      <LoadingButton
        type="button"
        onClick={handleReactivate}
        loading={mutation.isPending}
        disabled={!cooldown.canReactivate}
        fullWidth={!compact}
        variant={cooldown.canReactivate ? 'primary' : 'secondary'}
        className={
          compact
            ? `h-9 shrink-0 rounded-lg px-3 text-xs whitespace-nowrap ${!cooldown.canReactivate ? 'cursor-not-allowed opacity-50' : ''} ${className}`.trim()
            : `min-h-12 ${!cooldown.canReactivate ? 'cursor-not-allowed bg-slate-200 text-gray-500 opacity-50' : ''} ${className}`.trim()
        }
      >
        Reativar
      </LoadingButton>

      {actionError && (
        <p role="alert" className={`text-xs text-error ${compact ? 'sr-only' : ''}`}>
          {actionError}
        </p>
      )}

      <UpgradePlanModal
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        message={upgradeMessage}
        ctaHref="/settings/plan?plans=1"
        ctaLabel="Ver plano"
      />
    </>
  );
}
