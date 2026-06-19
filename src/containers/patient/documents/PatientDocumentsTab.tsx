import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LoadingButton, LoadingOverlay } from '@containers/loading';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { StandardModal } from '@shared/ui/StandardModal';
import { Toast } from '../Toast';
import { exportOrShareArtifactPdf } from './exportArtifactPdf';
import { PatientArtifactFiltersBar } from './PatientArtifactFiltersBar';
import { PatientArtifactReadModal } from './PatientArtifactReadModal';
import { PatientArtifactsEmptyState } from './PatientArtifactsEmptyState';
import { PatientArtifactsTable } from './PatientArtifactsTable';
import { PatientArtifactsTableSkeleton } from './PatientArtifactsTableSkeleton';
import type { ArtifactFilterValue, PatientArtifact, PatientArtifactsResponse } from './patient-artifacts.types';
import { filterPatientArtifacts } from './patient-artifacts.utils';
import { usePatientArtifacts } from './usePatientArtifacts';

interface PatientDocumentsTabProps {
  patientId: string;
  patientName?: string;
}

export function PatientDocumentsTab({ patientId, patientName }: PatientDocumentsTabProps) {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState<ArtifactFilterValue>('todos');
  const [search, setSearch] = useState('');
  const [readingArtifact, setReadingArtifact] = useState<PatientArtifact | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PatientArtifact | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);

  const { data, isPending, isFetching, error, refetch } = usePatientArtifacts(patientId);

  const allItems = data?.items ?? [];
  const items = useMemo(
    () => filterPatientArtifacts(allItems, filter, search),
    [allItems, filter, search],
  );

  const artifactDeepLink = searchParams.get('artifact');

  useEffect(() => {
    if (!artifactDeepLink || allItems.length === 0) return;
    const found = allItems.find((item) => item.id === artifactDeepLink);
    if (!found) return;

    setReadingArtifact(found);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('artifact');
        return next;
      },
      { replace: true },
    );
  }, [artifactDeepLink, allItems, setSearchParams]);

  const hasActiveFilters = filter !== 'todos' || search.trim().length > 0;

  const deleteMutation = useMutation({
    mutationFn: (artifactId: string) =>
      callFunction('delete-saved-recommendation', {
        patient_id: patientId,
        recommendation_id: artifactId,
      }),
    onMutate: async (artifactId) => {
      await queryClient.cancelQueries({ queryKey: ['patient-artifacts', patientId] });
      const previous = queryClient.getQueryData<PatientArtifactsResponse>([
        'patient-artifacts',
        patientId,
      ]);

      queryClient.setQueryData<PatientArtifactsResponse>(
        ['patient-artifacts', patientId],
        (old) =>
          old
            ? { ...old, items: old.items.filter((item) => item.id !== artifactId) }
            : old,
      );

      if (readingArtifact?.id === artifactId) setReadingArtifact(null);
      if (pendingDelete?.id === artifactId) setPendingDelete(null);

      return { previous };
    },
    onSuccess: () => {
      setToast({ message: 'Documento removido', variant: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['patient-artifacts', patientId] });
      void queryClient.invalidateQueries({ queryKey: ['saved-recommendations', patientId] });
      void queryClient.invalidateQueries({ queryKey: ['ai-artifact-status', patientId] });
    },
    onError: (err: Error, _artifactId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['patient-artifacts', patientId], context.previous);
      }
      setToast({
        message: err.message || 'Não foi possível remover o documento',
        variant: 'error',
      });
    },
  });

  const showInitialSkeleton = !data && (isPending || isFetching);
  const showRefetchOverlay = !!data && isFetching;
  const showEmpty = !showInitialSkeleton && !error && items.length === 0;

  async function handleExportPdf(artifact: PatientArtifact) {
    setExportingId(artifact.id);
    try {
      const result = await exportOrShareArtifactPdf(artifact, patientName);
      setToast({
        message: result === 'shared' ? 'PDF compartilhado' : 'PDF exportado com sucesso',
        variant: 'success',
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setToast({
        message: err instanceof Error ? err.message : 'Não foi possível exportar o PDF',
        variant: 'error',
      });
    } finally {
      setExportingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <PatientArtifactFiltersBar
        search={search}
        onSearchChange={setSearch}
        tipo={filter}
        onTipoChange={setFilter}
      />

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-error/10 bg-error-light/50 px-4 py-3 text-sm text-error"
        >
          <p>Não foi possível carregar os documentos salvos.</p>
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

      {showInitialSkeleton ? (
        <PatientArtifactsTableSkeleton />
      ) : showEmpty ? (
        <PatientArtifactsEmptyState filtered={hasActiveFilters} />
      ) : !error ? (
        <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <LoadingOverlay show={showRefetchOverlay} label="Atualizando documentos..." />

          <div className="border-b border-slate-100 px-4 py-2.5 sm:px-5">
            <p className="text-xs text-charcoal-muted">
              <span className="font-medium text-charcoal">{items.length}</span>{' '}
              {items.length === 1 ? 'documento salvo' : 'documentos salvos'}
              {hasActiveFilters ? (
                <span className="text-charcoal-muted/80"> · filtro ativo</span>
              ) : null}
              {search.trim() ? (
                <span className="text-charcoal-muted/80"> · busca: &quot;{search.trim()}&quot;</span>
              ) : null}
            </p>
          </div>

          <PatientArtifactsTable
            items={items}
            onRead={setReadingArtifact}
            onExportPdf={(artifact) => void handleExportPdf(artifact)}
            onRequestDelete={setPendingDelete}
            exportingId={exportingId}
            deletingId={deleteMutation.isPending ? pendingDelete?.id ?? null : null}
          />
        </div>
      ) : null}

      <PatientArtifactReadModal
        artifact={readingArtifact}
        onClose={() => setReadingArtifact(null)}
        onExportPdf={(artifact) => void handleExportPdf(artifact)}
        onRequestDelete={setPendingDelete}
        exportingId={exportingId}
        deletingId={deleteMutation.isPending ? pendingDelete?.id ?? null : null}
      />

      <Toast
        message={toast?.message ?? ''}
        visible={toast !== null}
        variant={toast?.variant ?? 'success'}
        onDismiss={() => setToast(null)}
      />

      <StandardModal
        isOpen={pendingDelete !== null}
        onClose={() => {
          if (!deleteMutation.isPending) setPendingDelete(null);
        }}
        title="Remover documento?"
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setPendingDelete(null)}
              disabled={deleteMutation.isPending}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-medium text-charcoal-muted hover:bg-white disabled:opacity-50 md:w-auto"
            >
              Cancelar
            </button>
            <LoadingButton
              type="button"
              onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
              loading={deleteMutation.isPending}
              variant="danger"
              className="min-h-11 md:w-auto"
            >
              Remover
            </LoadingButton>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-charcoal-muted">
          Esta ação não pode ser desfeita. O documento será removido permanentemente do prontuário
          deste paciente.
        </p>
      </StandardModal>
    </div>
  );
}
