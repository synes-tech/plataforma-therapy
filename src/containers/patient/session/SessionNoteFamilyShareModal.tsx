import { useEffect, useState } from 'react';
import { LoadingButton } from '@containers/loading';
import { AiMarkdownContent } from '@shared/ui/AiMarkdownContent';
import { StandardModal } from '@shared/ui/StandardModal';
import { SessionNoteFamilyRefineModal } from './SessionNoteFamilyRefineModal';

export type SessionNoteFamilyShareMode = 'as_is' | 'refined';

interface SessionNoteFamilyShareModalProps {
  isOpen: boolean;
  reportPreview: string;
  isSaving: boolean;
  onClose: () => void;
  onConfirm: (mode: SessionNoteFamilyShareMode, refinedText?: string) => void;
}

export function SessionNoteFamilyShareModal({
  isOpen,
  reportPreview,
  isSaving,
  onClose,
  onConfirm,
}: SessionNoteFamilyShareModalProps) {
  const [mode, setMode] = useState<SessionNoteFamilyShareMode>('as_is');
  const [refineModalOpen, setRefineModalOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode('as_is');
      setRefineModalOpen(false);
    }
  }, [isOpen]);

  const canConfirmAsIs = mode === 'as_is' && !isSaving;

  return (
    <>
      <StandardModal
        isOpen={isOpen && !refineModalOpen}
        onClose={onClose}
        title="Compartilhar com a família"
        size="lg"
        footer={
          <>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-charcoal transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Voltar
            </button>
            {mode === 'as_is' ? (
              <LoadingButton
                type="button"
                loading={isSaving}
                loadingLabel="Enviando..."
                disabled={!canConfirmAsIs}
                onClick={() => onConfirm('as_is')}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-dark active:scale-[0.98] disabled:opacity-50"
              >
                Confirmar envio
              </LoadingButton>
            ) : (
              <LoadingButton
                type="button"
                loading={false}
                disabled={isSaving}
                onClick={() => setRefineModalOpen(true)}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-dark active:scale-[0.98] disabled:opacity-50"
              >
                Continuar para refinar
              </LoadingButton>
            )}
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-charcoal-muted">
            O relatório clínico completo permanece privado no prontuário. Escolha o que a família verá no
            aplicativo.
          </p>

          <div className="space-y-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition-colors has-[:checked]:border-primary/40 has-[:checked]:bg-primary-50/30">
              <input
                type="radio"
                name="family-share-mode"
                value="as_is"
                checked={mode === 'as_is'}
                onChange={() => setMode('as_is')}
                disabled={isSaving}
                className="mt-1 h-4 w-4 border-slate-300 text-primary focus:ring-primary/30"
              />
              <span>
                <span className="block text-sm font-semibold text-charcoal">Enviar exatamente como está</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-charcoal-muted">
                  A família recebe o relatório gerado após a sessão, sem alterações.
                </span>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition-colors has-[:checked]:border-primary/40 has-[:checked]:bg-primary-50/30">
              <input
                type="radio"
                name="family-share-mode"
                value="refined"
                checked={mode === 'refined'}
                onChange={() => setMode('refined')}
                disabled={isSaving}
                className="mt-1 h-4 w-4 border-slate-300 text-primary focus:ring-primary/30"
              />
              <span>
                <span className="block text-sm font-semibold text-charcoal">Refinar para os pais</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-charcoal-muted">
                  Abra o editor em tela ampla para adaptar o texto. A versão clínica bruta continua privada.
                </span>
              </span>
            </label>
          </div>

          {mode === 'as_is' && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-charcoal-muted">Prévia do envio</p>
              <div className="mt-1 max-h-52 overflow-y-auto overscroll-contain rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 [scrollbar-color:rgb(148_163_184)_rgb(241_245_249)] scrollbar-thin">
                <AiMarkdownContent content={reportPreview} variant="light" />
              </div>
            </div>
          )}

          {mode === 'refined' && (
            <p className="rounded-xl border border-primary/15 bg-primary-50/40 px-3 py-2.5 text-xs leading-relaxed text-primary-dark">
              Clique em &quot;Continuar para refinar&quot; para abrir o editor em quase tela cheia, com rolagem e
              opção de maximizar.
            </p>
          )}
        </div>
      </StandardModal>

      <SessionNoteFamilyRefineModal
        isOpen={isOpen && refineModalOpen}
        initialText={reportPreview}
        isSaving={isSaving}
        onBack={() => setRefineModalOpen(false)}
        onConfirm={(refinedText) => onConfirm('refined', refinedText)}
      />
    </>
  );
}
