import { useState } from 'react';
import { LoadingButton } from '@containers/loading';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { StandardModal } from '@shared/ui/StandardModal';
import { Toast } from '../Toast';
import { PatientArtifactCard } from './PatientArtifactCard';
import { PatientArtifactFilterPills } from './PatientArtifactFilterPills';
import { PatientArtifactsEmptyState } from './PatientArtifactsEmptyState';
import { PatientArtifactsGrid, PatientArtifactsGridSkeleton } from './PatientArtifactsGrid';
import { copyTextToClipboard } from './patient-artifacts.clipboard';
import type { ArtifactFilterValue } from './patient-artifacts.types';
import { usePatientArtifacts } from './usePatientArtifacts';

interface PatientDocumentsTabProps {
  patientId: string;
}

export function PatientDocumentsTab({ patientId }: PatientDocumentsTabProps) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ArtifactFilterValue>('todos');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);

  const { data, isLoading, isFetching, error, isPlaceholderData } = usePatientArtifacts(
    patientId,
    filter,
  );

  const deleteMutation = useMutation({
    mutationFn: (artifactId: string) =>
      callFunction('delete-saved-recommendation', {
        patient_id: patientId,
        recommendation_id: artifactId,
      }),
    onSuccess: () => {
      setPendingDeleteId(null);
      setToast({ message: 'Documento removido', variant: 'success' });
      void queryClient.invalidateQueries({ queryKey: ['patient-artifacts', patientId] });
      void queryClient.invalidateQueries({ queryKey: ['saved-recommendations', patientId] });
      void queryClient.invalidateQueries({ queryKey: ['ai-artifact-status', patientId] });
    },
    onError: (err: Error) => {
      setToast({
        message: err.message || 'Não foi possível remover o documento',
        variant: 'error',
      });
    },
  });

  const items = data?.items ?? [];
  const showInitialSkeleton = isLoading && !isPlaceholderData;
  const showEmpty = !showInitialSkeleton && !error && items.length === 0;

  async function handleCopy(artifactId: string, text: string) {
    setCopyingId(artifactId);
    try {
      await copyTextToClipboard(text);
      setToast({ message: 'Copiado!', variant: 'success' });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : 'Não foi possível copiar',
        variant: 'error',
      });
    } finally {
      setCopyingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <PatientArtifactFilterPills value={filter} onChange={setFilter} />

      {showInitialSkeleton && <PatientArtifactsGridSkeleton />}

      {error && !isPlaceholderData && (
        <div className="rounded-2xl border border-error/10 bg-error-light/30 px-5 py-4 text-sm text-error">
          Não foi possível carregar os documentos salvos.
        </div>
      )}

      {showEmpty && <PatientArtifactsEmptyState filtered={filter !== 'todos'} />}

      {!showInitialSkeleton && !showEmpty && !error && (
        <PatientArtifactsGrid isFetching={isFetching && !isPlaceholderData}>
          {items.map((artifact) => (
            <div key={artifact.id} className="break-inside-avoid">
              <PatientArtifactCard
                artifact={artifact}
                onCopy={() => void handleCopy(artifact.id, artifact.conteudo_texto)}
                onRequestDelete={() => setPendingDeleteId(artifact.id)}
                isCopying={copyingId === artifact.id}
                isDeleting={deleteMutation.isPending && pendingDeleteId === artifact.id}
              />
            </div>
          ))}
        </PatientArtifactsGrid>
      )}

      <Toast
        message={toast?.message ?? ''}
        visible={toast !== null}
        variant={toast?.variant ?? 'success'}
        onDismiss={() => setToast(null)}
      />

      <StandardModal
        isOpen={pendingDeleteId !== null}
        onClose={() => {
          if (!deleteMutation.isPending) setPendingDeleteId(null);
        }}
        title="Excluir documento?"
        size="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setPendingDeleteId(null)}
              disabled={deleteMutation.isPending}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-medium text-charcoal-muted hover:bg-white disabled:opacity-50 md:w-auto"
            >
              Cancelar
            </button>
            <LoadingButton
              type="button"
              onClick={() => pendingDeleteId && deleteMutation.mutate(pendingDeleteId)}
              loading={deleteMutation.isPending}
              variant="danger"
              className="min-h-11 md:w-auto"
            >
              Excluir
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
