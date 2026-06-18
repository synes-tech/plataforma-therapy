import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { callFunction } from '@shared/lib/api';
import { usePaywall } from '@containers/paywall';
import { UpgradePlanModal } from '@containers/billing/UpgradePlanModal';
import { PatientRecordOptionsMenu } from './PatientRecordOptionsMenu';
import { PatientLinkManageModal } from './PatientLinkManageModal';
import { PatientHardDeleteConfirmModal } from './PatientHardDeleteConfirmModal';

interface PatientLinkManageFlowProps {
  patientId: string;
  patientName: string;
  statusVinculo?: 'ativo' | 'desvinculado';
}

type Step = 'closed' | 'choose' | 'delete_confirm';

export function PatientLinkManageFlow({
  patientId,
  patientName,
  statusVinculo = 'ativo',
}: PatientLinkManageFlowProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { refreshState } = usePaywall();

  const [step, setStep] = useState<Step>('closed');
  const [actionError, setActionError] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState('');

  const mutation = useMutation({
    mutationFn: (payload: { acao: 'unlink' | 'delete'; confirm_name?: string }) =>
      callFunction('manage-patient-link', {
        patient_id: patientId,
        ...payload,
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      queryClient.invalidateQueries({ queryKey: ['archived-patients'] });
      refreshState();
      setStep('closed');
      setActionError(null);

      if (variables.acao === 'delete') {
        navigate('/patients', { replace: true });
      } else {
        navigate('/patients', { replace: true });
      }
    },
    onError: (err: Error & { code?: string }) => {
      if (err.code === 'PAYMENT_REQUIRED') {
        setStep('closed');
        setUpgradeMessage(
          'Contrate o Arquivo Clínico Seguro para desvincular pacientes mantendo o histórico.',
        );
        setUpgradeOpen(true);
        return;
      }
      if (err.code === 'BACKUP_QUOTA_EXCEEDED' || err.code === 'QUOTA_EXCEEDED') {
        setUpgradeMessage(err.message);
        setUpgradeOpen(true);
        return;
      }
      setActionError(err.message);
    },
  });

  if (statusVinculo !== 'ativo') {
    return null;
  }

  function openManage() {
    setActionError(null);
    setStep('choose');
  }

  function closeAll() {
    if (mutation.isPending) return;
    setStep('closed');
    setActionError(null);
  }

  function confirmUnlink() {
    setActionError(null);
    mutation.mutate({ acao: 'unlink' });
  }

  function confirmDelete(confirmName: string) {
    setActionError(null);
    mutation.mutate({ acao: 'delete', confirm_name: confirmName });
  }

  return (
    <>
      <PatientRecordOptionsMenu onManageLink={openManage} disabled={mutation.isPending} />

      <PatientLinkManageModal
        isOpen={step === 'choose'}
        onClose={closeAll}
        patientName={patientName}
        onChooseUnlink={confirmUnlink}
        onChooseDelete={() => setStep('delete_confirm')}
        isProcessing={mutation.isPending}
      />

      <PatientHardDeleteConfirmModal
        isOpen={step === 'delete_confirm'}
        onClose={() => setStep('choose')}
        patientName={patientName}
        onConfirm={confirmDelete}
        isDeleting={mutation.isPending}
        error={actionError}
      />

      <UpgradePlanModal
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        title={
          upgradeMessage.includes('Arquivo Clínico') || upgradeMessage.includes('Backup')
            ? 'Licenças de backup necessárias'
            : 'Limite do plano atingido'
        }
        message={upgradeMessage}
        ctaHref="/billing"
        ctaLabel="Contratar espaço de backup"
        helperText="Adicione licenças de Arquivo Clínico Seguro no Controle de Plano — sem sair da plataforma."
      />
    </>
  );
}
