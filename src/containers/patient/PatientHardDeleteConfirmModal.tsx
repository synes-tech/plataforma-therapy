import { useState } from 'react';
import { LoadingButton } from '@containers/loading';
import { StandardModal } from '@shared/ui/StandardModal';
import { namesMatchForDelete } from './patient-link-manage.utils';

interface PatientHardDeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
  onConfirm: (confirmName: string) => void;
  isDeleting?: boolean;
  error?: string | null;
}

export function PatientHardDeleteConfirmModal({
  isOpen,
  onClose,
  patientName,
  onConfirm,
  isDeleting = false,
  error,
}: PatientHardDeleteConfirmModalProps) {
  const [typedName, setTypedName] = useState('');

  const canConfirm = namesMatchForDelete(typedName, patientName);

  function handleClose() {
    if (isDeleting) return;
    setTypedName('');
    onClose();
  }

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Excluir para sempre?"
      size="md"
      footer={
        <>
          <button
            type="button"
            onClick={handleClose}
            disabled={isDeleting}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-medium text-charcoal-muted hover:bg-white disabled:opacity-50 md:w-auto"
          >
            Voltar
          </button>
          <LoadingButton
            type="button"
            onClick={() => onConfirm(typedName.trim())}
            loading={isDeleting}
            disabled={!canConfirm}
            variant="danger"
            className="h-11 font-semibold md:w-auto"
          >
            Apagar para sempre
          </LoadingButton>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-charcoal-muted">
          Você está prestes a apagar <span className="font-semibold text-charcoal">{patientName}</span> e
          todos os dados clínicos associados. Esta ação é <span className="font-medium text-error">irreversível</span>.
        </p>

        <div>
          <label htmlFor="confirm-patient-name" className="mb-1.5 block text-sm font-medium text-charcoal">
            Digite o nome do paciente para confirmar
          </label>
          <input
            id="confirm-patient-name"
            type="text"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder={patientName}
            autoComplete="off"
            className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-charcoal focus:border-error/40 focus:outline-none focus:ring-[3px] focus:ring-error/10"
          />
          <p className="mt-1.5 text-xs text-charcoal-muted">
            Exatamente: <span className="font-medium text-charcoal">{patientName}</span>
          </p>
        </div>

        {error && (
          <div role="alert" className="rounded-xl border border-error/20 bg-error-light px-4 py-3 text-sm text-error">
            {error}
          </div>
        )}
      </div>
    </StandardModal>
  );
}
