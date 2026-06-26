import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoadingOverlay, ListPageSkeleton } from '@containers/loading';
import { callFunction } from '@shared/lib/api';
import { FamilySessionReadModal } from './FamilySessionReadModal';
import { FamilySessionsTable } from './FamilySessionsTable';
import type { FamilySessionHistoryItem, FamilySessionHistoryResponse } from './family-session.types';

export function FamilySessionHistoryTab() {
  const [readingSessionId, setReadingSessionId] = useState<string | null>(null);

  const { data, isPending, isFetching, error, refetch } = useQuery({
    queryKey: ['family-session-history'],
    queryFn: () =>
      callFunction<FamilySessionHistoryResponse>('get-family-session-history', {
        page: 1,
        page_size: 50,
      }),
    staleTime: 2 * 60_000,
  });

  const items = data?.items ?? [];
  const showInitialSkeleton = !data && (isPending || isFetching);
  const showRefetchOverlay = !!data && isFetching;

  if (showInitialSkeleton) {
    return <ListPageSkeleton rows={4} rowClassName="h-16 rounded-xl" className="space-y-3" />;
  }

  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-error/15 bg-error-light/40 px-4 py-3 text-sm text-error">
        <p>Não foi possível carregar o histórico de sessões.</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-3 rounded-lg border border-error/20 bg-white px-3 py-1.5 text-xs font-medium text-error"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-12 text-center">
        <p className="text-sm text-charcoal-muted">Nenhuma sessão realizada registrada ainda.</p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <LoadingOverlay show={showRefetchOverlay} label="Atualizando sessões..." />

      <div className="border-b border-slate-100 px-4 py-2.5 sm:px-5">
        <p className="text-xs text-charcoal-muted">
          <span className="font-medium text-charcoal">{data?.total_count ?? items.length}</span>{' '}
          {(data?.total_count ?? items.length) === 1 ? 'sessão registrada' : 'sessões registradas'}
        </p>
      </div>

      <FamilySessionsTable
        patientName={data?.patient_name ?? ''}
        items={items}
        onView={(session: FamilySessionHistoryItem) => setReadingSessionId(session.id)}
      />

      <FamilySessionReadModal
        sessionId={readingSessionId}
        patientName={data?.patient_name ?? ''}
        onClose={() => setReadingSessionId(null)}
      />
    </div>
  );
}
