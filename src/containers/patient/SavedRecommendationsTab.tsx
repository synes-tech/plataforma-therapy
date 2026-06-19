import { useState } from 'react';
import { LoadingButton, ListPageSkeleton } from '@containers/loading';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import { StandardModal } from '@shared/ui/StandardModal';
import { RecordEmptyState } from './RecordEmptyState';
import { Toast } from './Toast';
import { SavedRecommendationMasterCard } from './SavedRecommendationMasterCard';
import {
  SavedRecommendationsTimeline,
  SavedRecommendationTimelineItem,
} from './SavedRecommendationsTimeline';
import type { SavedRecommendationRecord } from './session-recommendations.types';

interface ListResponse {
  items: SavedRecommendationRecord[];
}

interface SavedRecommendationsTabProps {
  patientId: string;
}

export function SavedRecommendationsTab({ patientId }: SavedRecommendationsTabProps) {
  const queryClient = useQueryClient();
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['saved-recommendations', patientId],
    queryFn: () =>
      callFunction<ListResponse>('list-saved-recommendations', { patient_id: patientId }),
  });

  const deleteMutation = useMutation({
    mutationFn: (recommendationId: string) =>
      callFunction('delete-saved-recommendation', {
        patient_id: patientId,
        recommendation_id: recommendationId,
      }),
    onSuccess: () => {
      setPendingDeleteId(null);
      setToast({ message: 'Recomendação removida', variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['saved-recommendations', patientId] });
    },
    onError: (err: Error) => {
      setToast({
        message: err.message || 'Não foi possível remover a recomendação',
        variant: 'error',
      });
    },
  });

  const items = data?.items ?? [];

  if (isLoading) {
    return <ListPageSkeleton rows={2} rowClassName="h-40 rounded-2xl" className="flex flex-col gap-6" />;
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-error/10 bg-error-light/30 px-5 py-4 text-sm text-error">
        Não foi possível carregar o histórico de recomendações.
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <RecordEmptyState
        variant="saved-history"
        action={
          <p className="text-xs text-charcoal-muted/70">
            Na aba Visão Geral, use &quot;Salvar&quot; no card de ações recomendadas.
          </p>
        }
      />
    );
  }

  return (
    <>
      <Toast
        message={toast?.message ?? ''}
        visible={!!toast}
        variant={toast?.variant}
        onDismiss={() => setToast(null)}
      />

      <StandardModal
        isOpen={!!pendingDeleteId}
        onClose={() => {
          if (!deleteMutation.isPending) setPendingDeleteId(null);
        }}
        title="Remover recomendação?"
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
              Remover
            </LoadingButton>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-charcoal-muted">
          Esta ação não pode ser desfeita. O bloco de recomendações será removido do histórico
          deste paciente.
        </p>
      </StandardModal>

      <SavedRecommendationsTimeline>
        {items.map((item, index) => (
          <SavedRecommendationTimelineItem key={item.id} isLast={index === items.length - 1}>
            <SavedRecommendationMasterCard
              item={item}
              onRequestDelete={() => setPendingDeleteId(item.id)}
              isDeleting={deleteMutation.isPending && pendingDeleteId === item.id}
            />
          </SavedRecommendationTimelineItem>
        ))}
      </SavedRecommendationsTimeline>
    </>
  );
}
