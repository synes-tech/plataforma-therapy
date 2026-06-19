import { ARTIFACT_FILTER_OPTIONS } from './patient-artifacts.constants';
import type { ArtifactFilterValue } from './patient-artifacts.types';

interface PatientArtifactFilterPillsProps {
  value: ArtifactFilterValue;
  onChange: (value: ArtifactFilterValue) => void;
}

export function PatientArtifactFilterPills({ value, onChange }: PatientArtifactFilterPillsProps) {
  return (
    <div
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide"
      role="tablist"
      aria-label="Filtrar documentos salvos"
    >
      {ARTIFACT_FILTER_OPTIONS.map((option) => {
        const isActive = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.value)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-primary-dark text-white shadow-sm'
                : 'bg-white text-charcoal-muted ring-1 ring-slate-200 hover:bg-slate-50 hover:text-charcoal'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
