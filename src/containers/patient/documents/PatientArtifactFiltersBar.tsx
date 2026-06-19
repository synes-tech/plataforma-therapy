import { ARTIFACT_FILTER_OPTIONS } from './patient-artifacts.constants';
import type { ArtifactFilterValue } from './patient-artifacts.types';

const selectClass =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-charcoal focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10';

const labelClass =
  'mb-1 block text-[11px] font-semibold uppercase tracking-wider text-charcoal-muted';

interface PatientArtifactFiltersBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  tipo: ArtifactFilterValue;
  onTipoChange: (value: ArtifactFilterValue) => void;
}

export function PatientArtifactFiltersBar({
  search,
  onSearchChange,
  tipo,
  onTipoChange,
}: PatientArtifactFiltersBarProps) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="block min-w-[160px] flex-[2]">
        <span className={labelClass}>Buscar</span>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-charcoal-muted/60">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Título ou conteúdo..."
            aria-label="Buscar documentos"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 text-sm text-charcoal placeholder:text-charcoal-muted/50 focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
          />
        </div>
      </label>

      <label className="block min-w-[130px] flex-1 sm:max-w-[220px]">
        <span className={labelClass}>Tipo</span>
        <select
          value={tipo}
          onChange={(e) => onTipoChange(e.target.value as ArtifactFilterValue)}
          className={selectClass}
          aria-label="Filtrar por tipo de documento"
        >
          {ARTIFACT_FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
