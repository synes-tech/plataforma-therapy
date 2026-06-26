import { Spinner } from '@containers/loading';
import { AI_ARTIFACT_OPTIONS } from './patient-copilot-artifact.constants';
import type { AiArtifactType } from './patient-copilot.types';

interface PatientCopilotArtifactToolbarProps {
  savedTypes: Set<AiArtifactType>;
  savingType: AiArtifactType | null;
  savedArtifactIds: Partial<Record<AiArtifactType, string>>;
  onRequestSave: (tipo: AiArtifactType) => void;
  onViewArtifact: (artifactId: string) => void;
  onViewDocuments: () => void;
}

function CheckIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  );
}

export function PatientCopilotArtifactToolbar({
  savedTypes,
  savingType,
  savedArtifactIds,
  onRequestSave,
  onViewArtifact,
  onViewDocuments,
}: PatientCopilotArtifactToolbarProps) {
  return (
    <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-charcoal-muted">Salvar no prontuário</p>

      <div className="flex flex-col gap-2">
        {AI_ARTIFACT_OPTIONS.map((option) => {
          const isSaved = savedTypes.has(option.type);
          const isSaving = savingType === option.type;
          const artifactId = savedArtifactIds[option.type];

          if (isSaved) {
            return (
              <div
                key={option.type}
                className="flex flex-col gap-2 rounded-xl border border-mint/25 bg-mint-50/80 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-mint-dark shadow-sm">
                    <CheckIcon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-mint-dark">{option.label} salva</p>
                    <p className="text-[11px] text-charcoal-muted">Disponível em Documentos Salvos</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => (artifactId ? onViewArtifact(artifactId) : onViewDocuments())}
                  className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-charcoal px-3.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-charcoal-light active:scale-[0.98]"
                >
                  Visualizar arquivo salvo
                  <ArrowIcon />
                </button>
              </div>
            );
          }

          return (
            <button
              key={option.type}
              type="button"
              disabled={isSaving}
              onClick={() => onRequestSave(option.type)}
              className="inline-flex h-10 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 text-left shadow-sm transition-all hover:border-primary/35 hover:bg-primary-50/50 hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F8FAF9] text-base">
                  {option.icon}
                </span>
                <span className="text-sm font-semibold text-charcoal">{option.label}</span>
              </span>
              {isSaving ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
                  <Spinner size="xs" />
                  Salvando...
                </span>
              ) : (
                <span className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                  Salvar
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
