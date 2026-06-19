import type { PatientListFilters } from './patient-list.types';

interface PatientListFiltersBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filters: PatientListFilters;
  onFiltersChange: (filters: PatientListFilters) => void;
  isFetching?: boolean;
}

const selectClass =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-charcoal focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10';

export function PatientListFiltersBar({
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  isFetching = false,
}: PatientListFiltersBarProps) {
  function update<K extends keyof PatientListFilters>(key: K, value: PatientListFilters[K]) {
    onFiltersChange({ ...filters, [key]: value });
  }

  const labelClass =
    'mb-1 block text-[11px] font-semibold uppercase tracking-wider text-charcoal-muted';

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
            placeholder="Nome ou CPF..."
            aria-label="Buscar pacientes"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 text-sm text-charcoal placeholder:text-charcoal-muted/50 focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
          />
          {isFetching && (
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-xs text-charcoal-muted">
              Buscando...
            </span>
          )}
        </div>
      </label>

      <label className="block min-w-[130px] flex-1 sm:max-w-[180px]">
        <span className={labelClass}>Status</span>
        <select
          value={filters.status}
          onChange={(e) => update('status', e.target.value as PatientListFilters['status'])}
          className={selectClass}
          aria-label="Filtrar por status"
        >
          <option value="all">Todos</option>
          <option value="active">Ativo</option>
          <option value="inactive">Inativo</option>
          <option value="suspended">Suspenso</option>
        </select>
      </label>

      <label className="block min-w-[130px] flex-1 sm:max-w-[180px]">
        <span className={labelClass}>Diagnóstico</span>
        <select
          value={filters.diagnosis}
          onChange={(e) => update('diagnosis', e.target.value as PatientListFilters['diagnosis'])}
          className={selectClass}
          aria-label="Filtrar por diagnóstico"
        >
          <option value="all">Todos</option>
          <option value="tea">TEA / Autismo</option>
          <option value="tdah">TDAH</option>
          <option value="anxiety">Ansiedade / TOC</option>
          <option value="other">Outros</option>
        </select>
      </label>

      <label className="block min-w-[130px] flex-1 sm:max-w-[180px]">
        <span className={labelClass}>Ordenar</span>
        <select
          value={filters.sort}
          onChange={(e) => update('sort', e.target.value as PatientListFilters['sort'])}
          className={selectClass}
          aria-label="Ordenar lista"
        >
          <option value="name_asc">Nome A → Z</option>
          <option value="name_desc">Nome Z → A</option>
          <option value="recent">Mais recentes</option>
          <option value="age_asc">Idade (menor)</option>
          <option value="age_desc">Idade (maior)</option>
        </select>
      </label>
    </div>
  );
}
