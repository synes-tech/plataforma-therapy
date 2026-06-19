import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { PatientHardDeleteConfirmModal } from './PatientHardDeleteConfirmModal';

interface PatientArchiveHardDeleteFlowProps {
  patientId: string;
  patientName: string;
  compact?: boolean;
  className?: string;
}

export function PatientArchiveHardDeleteFlow({
  patientId,
  patientName,
  compact = false,
  className = '',
}: PatientArchiveHardDeleteFlowProps) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (confirmName: string) =>
      callFunction('manage-patient-link', {
        patient_id: patientId,
        acao: 'delete',
        confirm_name: confirmName,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archived-patients'] });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      setConfirmOpen(false);
      setActionError(null);
    },
    onError: (err: Error) => {
      setActionError(err.message);
    },
  });

  function openConfirm() {
    setActionError(null);
    setConfirmOpen(true);
  }

  function closeConfirm() {
    if (mutation.isPending) return;
    setConfirmOpen(false);
    setActionError(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={openConfirm}
        disabled={mutation.isPending}
        className={
          compact
            ? `inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-error/20 bg-white px-3 text-xs font-medium text-error transition-colors hover:bg-error-light disabled:opacity-50 whitespace-nowrap ${className}`.trim()
            : `inline-flex h-10 items-center justify-center rounded-xl border border-error/20 bg-white px-4 text-sm font-medium text-error transition-colors hover:bg-error-light disabled:opacity-50 ${className}`.trim()
        }
      >
        Excluir definitivamente
      </button>

      <PatientHardDeleteConfirmModal
        isOpen={confirmOpen}
        onClose={closeConfirm}
        patientName={patientName}
        onConfirm={(confirmName) => mutation.mutate(confirmName)}
        isDeleting={mutation.isPending}
        error={actionError}
      />
    </>
  );
}
