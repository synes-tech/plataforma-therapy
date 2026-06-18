import { StandardModal } from '@shared/ui/StandardModal';

interface PatientLinkManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
  onChooseUnlink: () => void;
  onChooseDelete: () => void;
  isProcessing?: boolean;
}

export function PatientLinkManageModal({
  isOpen,
  onClose,
  patientName,
  onChooseUnlink,
  onChooseDelete,
  isProcessing = false,
}: PatientLinkManageModalProps) {
  return (
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title="Gerenciar vínculo"
      size="lg"
      footer={
        <button
          type="button"
          onClick={onClose}
          disabled={isProcessing}
          className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-medium text-charcoal-muted hover:bg-slate-100 disabled:opacity-50 md:w-auto"
        >
          Cancelar
        </button>
      }
    >
      <p className="mb-5 text-sm text-charcoal-muted">
        Escolha como deseja proceder com <span className="font-medium text-charcoal">{patientName}</span>.
      </p>

      <div
        role="alert"
        className="mb-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
      >
        <span className="shrink-0 text-base" aria-hidden>
          ⚠️
        </span>
        <p>
          <span className="font-semibold">Atenção:</span> Ao desvincular, por regras de segurança e limite de
          plano, este paciente ficará bloqueado para reativação por 30 dias.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <button
          type="button"
          disabled={isProcessing}
          onClick={onChooseUnlink}
          className="rounded-2xl border border-primary-100 bg-primary-50 p-5 text-left transition-all hover:border-primary/30 hover:shadow-sm disabled:opacity-50"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lg shadow-sm" aria-hidden>
              📦
            </span>
            <div>
              <p className="font-display text-base font-semibold text-charcoal">
                Desvincular e manter histórico
              </p>
              <p className="mt-1 text-sm leading-relaxed text-charcoal-muted">
                Libere a vaga na sua agenda, mas guarde o histórico clínico em segurança no backup.
              </p>
              <p className="mt-2 text-xs font-medium text-primary-dark">Recomendado</p>
            </div>
          </div>
        </button>

        <button
          type="button"
          disabled={isProcessing}
          onClick={onChooseDelete}
          className="rounded-2xl border border-slate-100 bg-white p-5 text-left transition-colors hover:border-error/20 hover:bg-error-light/30 disabled:opacity-50"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-error-light/50 text-lg" aria-hidden>
              🗑️
            </span>
            <div>
              <p className="font-display text-base font-semibold text-error">Excluir definitivamente</p>
              <p className="mt-1 text-sm leading-relaxed text-charcoal-muted">
                Apaga permanentemente prontuário, áudios, resumos e diário. Esta ação não pode ser desfeita.
              </p>
            </div>
          </div>
        </button>
      </div>
    </StandardModal>
  );
}
