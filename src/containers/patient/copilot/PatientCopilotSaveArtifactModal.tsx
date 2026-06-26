import { useEffect, useState } from 'react';
import { LoadingButton } from '@containers/loading';
import { AiMarkdownContent } from '@shared/ui/AiMarkdownContent';
import { StandardModal } from '@shared/ui/StandardModal';
import { PatientCopilotFamilyShareToggle } from './PatientCopilotFamilyShareToggle';
import { truncateArtifactPreview } from '../documents/patient-artifacts.format';
import type { AiArtifactType } from './patient-copilot.types';

interface PatientCopilotSaveArtifactModalProps {
  isOpen: boolean;
  artifactLabel: string;
  contentPreview: string;
  tipo: AiArtifactType | null;
  isSaving: boolean;
  onClose: () => void;
  onConfirm: (compartilhadoFamilia: boolean) => void;
}

export function PatientCopilotSaveArtifactModal({
  isOpen,
  artifactLabel,
  contentPreview,
  tipo,
  isSaving,
  onClose,
  onConfirm,
}: PatientCopilotSaveArtifactModalProps) {
  const [compartilhadoFamilia, setCompartilhadoFamilia] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCompartilhadoFamilia(false);
    }
  }, [isOpen, tipo]);

  const showRelatorioWarning = tipo === 'relatorio_sessao' && compartilhadoFamilia;

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title="Salvar no prontuário"
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-charcoal transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <LoadingButton
            type="button"
            loading={isSaving}
            onClick={() => onConfirm(compartilhadoFamilia)}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-dark active:scale-[0.98] disabled:opacity-50"
          >
            Confirmar salvamento
          </LoadingButton>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-charcoal-muted">Tipo</p>
          <p className="mt-1 text-sm font-medium text-charcoal">{artifactLabel}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-charcoal-muted">Prévia</p>
          <div className="mt-1 max-h-32 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
            <AiMarkdownContent content={truncateArtifactPreview(contentPreview, 280)} variant="light" />
          </div>
        </div>

        <PatientCopilotFamilyShareToggle
          checked={compartilhadoFamilia}
          onChange={setCompartilhadoFamilia}
          disabled={isSaving}
        />

        {showRelatorioWarning && (
          <p className="rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-2.5 text-xs leading-relaxed text-amber-800">
            Relatórios de sessão costumam conter informações clínicas sensíveis. Compartilhe apenas se o
            conteúdo for adequado para a família.
          </p>
        )}
      </div>
    </StandardModal>
  );
}
