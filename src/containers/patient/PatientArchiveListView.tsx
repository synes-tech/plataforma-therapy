import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoadingOverlay, PatientListTableSkeleton } from '@containers/loading';
import { callFunction } from '@shared/lib/api';
import { PatientArchiveEmptyState } from './PatientArchiveEmptyState';
import { PatientArchiveTable } from './PatientArchiveTable';
import { filterArchivedPatients, formatArchiveLicenseLabel } from './patient-archive.utils';
import type { ArchivedPatientsPayload } from './patient-archive.types';

export function PatientArchiveListView() {
  const [search, setSearch] = useState('');

  const { data, isPending, isFetching, error, refetch } = useQuery({
    queryKey: ['archived-patients'],
    queryFn: () => callFunction<ArchivedPatientsPayload>('get-archived-patients', {}),
  });

  const patients = data?.patients ?? [];
  const filtered = useMemo(
    () => filterArchivedPatients(patients, search),
    [patients, search],
  );

  const licenseLabel = formatArchiveLicenseLabel(
    data?.archived_count ?? 0,
    data?.quantidade_backup_pacientes ?? 0,
  );

  const showTableSkeleton = !data && (isPending || isFetching);
  const showRefetchOverlay = !!data && isFetching;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm sm:px-5">
        <p className="text-sm font-medium text-charcoal">{licenseLabel}</p>
        <p className="mt-0.5 text-xs text-charcoal-muted">
          Histórico clínico preservado em armazenamento a frio. Pacientes aqui não ocupam vagas ativas.
        </p>
      </div>

      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-charcoal-muted">
          Buscar
        </span>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-charcoal-muted/60">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome ou CPF..."
            aria-label="Buscar pacientes arquivados"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 text-sm text-charcoal placeholder:text-charcoal-muted/50 focus:border-primary/50 focus:outline-none focus:ring-[3px] focus:ring-primary/10"
          />
        </div>
      </label>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-error/10 bg-error-light/50 px-4 py-3 text-sm text-error"
        >
          <p>{error instanceof Error ? error.message : 'Não foi possível carregar o arquivo clínico.'}</p>
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
        <PatientListTableSkeleton label="Carregando arquivo clínico..." />
      ) : error ? null : patients.length === 0 ? (
        <PatientArchiveEmptyState />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
          <p className="text-sm text-charcoal-muted">
            Nenhum paciente encontrado para &quot;{search.trim()}&quot;.
          </p>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <LoadingOverlay show={showRefetchOverlay} label="Atualizando arquivo clínico..." />

          <div className="border-b border-slate-100 px-4 py-2.5 sm:px-5">
            <p className="text-xs text-charcoal-muted">
              <span className="font-medium text-charcoal">{filtered.length}</span>{' '}
              {filtered.length === 1 ? 'paciente arquivado' : 'pacientes arquivados'}
              {search.trim() ? (
                <span className="text-charcoal-muted/80"> · busca: &quot;{search.trim()}&quot;</span>
              ) : null}
            </p>
          </div>

          <PatientArchiveTable patients={filtered} />
        </div>
      )}
    </div>
  );
}
