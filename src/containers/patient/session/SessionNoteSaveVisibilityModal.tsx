import { StandardModal } from '@shared/ui/StandardModal';

interface SessionNoteSaveVisibilityModalProps {
  isOpen: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSavePrivate: () => void;
  onShareWithFamily: () => void;
}

export function SessionNoteSaveVisibilityModal({
  isOpen,
  isSaving,
  onClose,
  onSavePrivate,
  onShareWithFamily,
}: SessionNoteSaveVisibilityModalProps) {
  return (
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title="Como deseja salvar?"
      size="md"
      footer={
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-charcoal transition-colors hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
        >
          Cancelar
        </button>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-charcoal-muted">
          Escolha se o relatório fica apenas no prontuário clínico ou se também será compartilhado com a
          família.
        </p>

        <button
          type="button"
          disabled={isSaving}
          onClick={onSavePrivate}
          className="flex w-full flex-col items-start gap-1 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left transition-colors hover:border-primary/30 hover:bg-primary-50/40 disabled:opacity-50"
        >
          <span className="text-sm font-semibold text-charcoal">Salvar de maneira privada</span>
          <span className="text-xs leading-relaxed text-charcoal-muted">
            Não será compartilhado com a família. A versão clínica completa permanece no prontuário.
          </span>
        </button>

        <button
          type="button"
          disabled={isSaving}
          onClick={onShareWithFamily}
          className="flex w-full flex-col items-start gap-1 rounded-2xl border border-primary/20 bg-primary-50/30 px-4 py-4 text-left transition-colors hover:border-primary/40 hover:bg-primary-50/60 disabled:opacity-50"
        >
          <span className="text-sm font-semibold text-primary-dark">Compartilhar com a família</span>
          <span className="text-xs leading-relaxed text-charcoal-muted">
            Você poderá enviar como está ou refinar uma versão específica para os pais.
          </span>
        </button>
      </div>
    </StandardModal>
  );
}
