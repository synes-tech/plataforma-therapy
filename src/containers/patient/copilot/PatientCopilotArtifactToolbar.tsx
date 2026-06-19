import { Spinner } from '@containers/loading';
import { AI_ARTIFACT_OPTIONS } from './patient-copilot-artifact.constants';
import type { AiArtifactType } from './patient-copilot.types';

interface PatientCopilotArtifactToolbarProps {
  content: string;
  savedTypes: Set<AiArtifactType>;
  savingType: AiArtifactType | null;
  onSave: (tipo: AiArtifactType) => void;
}

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function PatientCopilotArtifactToolbar({
  content,
  savedTypes,
  savingType,
  onSave,
}: PatientCopilotArtifactToolbarProps) {
  if (!content.trim()) return null;

  return (
    <div className="mt-3 border-t border-slate-100 pt-2">
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-gray-400">
        Salvar como
      </p>
      <div className="-mx-1 flex gap-1 overflow-x-auto pb-1 scrollbar-hide sm:flex-wrap sm:overflow-visible">
        {AI_ARTIFACT_OPTIONS.map((option) => {
          const isSaved = savedTypes.has(option.type);
          const isSaving = savingType === option.type;

          return (
            <button
              key={option.type}
              type="button"
              disabled={isSaved || isSaving}
              onClick={() => onSave(option.type)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                isSaved
                  ? 'text-emerald-600'
                  : 'text-gray-500 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50'
              }`}
            >
              {isSaved ? (
                <>
                  <CheckIcon />
                  <span>Salvo</span>
                </>
              ) : isSaving ? (
                <>
                  <Spinner size="xs" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <span aria-hidden>{option.icon}</span>
                  <span>{option.label}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
