import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoadingOverlay, PatientListTableSkeleton } from '@containers/loading';
import { callFunction } from '@shared/lib/api';
import { useAuthStore } from '@shared/lib/auth-store';
import { PatientActiveTable } from './PatientActiveTable';
import { PatientListFiltersBar } from './PatientListFiltersBar';
import { PatientListPagination } from './PatientListPagination';
import {
  DEFAULT_PATIENT_FILTERS,
  PATIENT_PAGE_SIZE,
  type PatientListFilters,
  type PatientListItem,
} from './patient-list.types';
import {
  applyPatientListFilters,
  getPaginationMeta,
  paginatePatients,
} from './patient-list.utils';

interface PatientActiveListViewProps {
  onOpenCreate: () => void;
}

export function PatientActiveListView({ onOpenCreate }: PatientActiveListViewProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading = useAuthStore((s) => s.isLoading || !s.initialized);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState<PatientListFilters>(DEFAULT_PATIENT_FILTERS);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters]);

  const { data: patients, isPending, isFetching, error, refetch } = useQuery({
    queryKey: ['patients', debouncedSearch],
    queryFn: () =>
      callFunction<PatientListItem[]>('list-patients', {
        ...(debouncedSearch ? { q: debouncedSearch } : {}),
      }),
    enabled: isAuthenticated,
  });

  const processed = useMemo(
    () => applyPatientListFilters(patients ?? [], filters),
    [patients, filters],
  );

  const pagination = useMemo(
    () => getPaginationMeta(processed.length, page, PATIENT_PAGE_SIZE),
    [processed.length, page],
  );

  const pageItems = useMemo(
    () => paginatePatients(processed, pagination.safePage, PATIENT_PAGE_SIZE),
    [processed, pagination.safePage],
  );

  const hasActiveFilters =
    filters.status !== 'all' ||
    filters.diagnosis !== 'all' ||
    filters.sort !== DEFAULT_PATIENT_FILTERS.sort ||
    debouncedSearch.length > 0;

  const showTableSkeleton = authLoading || (!patients && (isPending || isFetching));
  const showRefetchOverlay = !!patients && isFetching;

  return (
    <div className="space-y-3">
      <PatientListFiltersBar
        search={search}
        onSearchChange={setSearch}
        filters={filters}
        onFiltersChange={setFilters}
        isFetching={showRefetchOverlay}
      />

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-error/10 bg-error-light/50 px-4 py-3 text-sm text-error"
        >
          <p>{error instanceof Error ? error.message : 'Não foi possível carregar os pacientes.'}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="mt-3 rounded-lg border border-error/20 bg-white px-3 py-1.5 text-xs font-medium text-error transition-colors hover:bg-error-light/30 disabled:opacity-50"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {showTableSkeleton ? (
        <PatientListTableSkeleton />
      ) : error ? null : processed.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
          <p className="text-sm text-charcoal-muted">
            {hasActiveFilters
              ? 'Nenhum paciente encontrado com os filtros aplicados.'
              : 'Nenhum paciente cadastrado ainda.'}
          </p>
          {!hasActiveFilters && (
            <button
              type="button"
              onClick={onOpenCreate}
              className="mt-4 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-medium text-white shadow-sm transition-all hover:bg-primary-dark active:scale-[0.98]"
            >
              Cadastrar o primeiro paciente
            </button>
          )}
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <LoadingOverlay show={showRefetchOverlay} label="Carregando pacientes..." />

          <div className="border-b border-slate-100 px-4 py-2.5 sm:px-5">
            <p className="text-xs text-charcoal-muted">
              <span className="font-medium text-charcoal">{processed.length}</span>{' '}
              {processed.length === 1 ? 'paciente ativo' : 'pacientes ativos'}
              {debouncedSearch ? (
                <span className="text-charcoal-muted/80"> · busca: &quot;{debouncedSearch}&quot;</span>
              ) : null}
            </p>
          </div>

          <PatientActiveTable patients={pageItems} />

          <PatientListPagination
            page={pagination.safePage}
            totalPages={pagination.totalPages}
            total={processed.length}
            start={pagination.start}
            end={pagination.end}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
