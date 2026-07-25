import { StandardModal } from '@shared/ui/StandardModal';
import { PatientQuotaPackPanel, type PatientQuotaPackPanelProps } from './PatientQuotaPackPanel';

interface PatientQuotaPackModalProps extends PatientQuotaPackPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PatientQuotaPackModal({ isOpen, onClose, ...panelProps }: PatientQuotaPackModalProps) {
  return (
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title="Módulos Adicionais de pacientes"
      size="lg"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-charcoal transition-colors hover:bg-slate-50 md:w-auto"
        >
          Fechar
        </button>
      }
    >
      <PatientQuotaPackPanel {...panelProps} onPurchaseSuccess={onClose} />
    </StandardModal>
  );
}
