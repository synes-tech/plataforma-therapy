import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ListPageSkeleton, Spinner } from '@containers/loading';
import { callFunction } from '@shared/lib/api';
import { SessionHistoryItem } from './SessionHistoryItem';
import type { PatientSessionsResponse } from './session-history.types';

const PAGE_SIZE = 10;

interface SessionHistoryPanelProps {
  patientId: string;
  patientName: string;
}

export function SessionHistoryPanel({ patientId, patientName }: SessionHistoryPanelProps) {
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['patient-sessions', patientId, page],
    queryFn: () =>
      callFunction<PatientSessionsResponse>('get-patient-sessions', {
        patient_id: patientId,
        page,
        page_size: PAGE_SIZE,
      }),
  });

  useEffect(() => {
    function onJobComplete() {
      void refetch();
    }
    window.addEventListener('ai-job-complete', onJobComplete);
    return () => window.removeEventListener('ai-job-complete', onJobComplete);
  }, [refetch]);

  const items = data?.items ?? [];
  const totalCount = data?.total_count ?? 0;
  const hasMore = data?.has_more ?? false;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <section className="mt-2">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-charcoal">
            Histórico de Sessões
          </h2>
          <p className="mt-0.5 text-xs text-charcoal-muted">
            {totalCount > 0
              ? `${totalCount} sessão${totalCount !== 1 ? 'ões' : ''} registrada${totalCount !== 1 ? 's' : ''}`
              : 'Sessões anteriores aparecerão aqui após a gravação e processamento.'}
          </p>
        </div>
        {isFetching && !isLoading && (
          <span className="inline-flex items-center gap-1.5 text-xs text-primary">
            <Spinner size="xs" />
            Atualizando...
          </span>
        )}
      </header>

      {isLoading && <ListPageSkeleton rows={3} rowClassName="h-20" />}

      {error && (
        <div className="rounded-2xl border border-error/10 bg-error-light/30 px-5 py-4 text-sm text-error">
          Não foi possível carregar o histórico de sessões.
        </div>
      )}

      {!isLoading && !error && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center">
          <p className="text-sm text-charcoal-muted">Nenhuma sessão no histórico ainda.</p>
          <p className="mt-1 text-xs text-charcoal-muted/70">
            Use o ditado de pós-consulta acima para registrar a primeira sessão.
          </p>
        </div>
      )}

      {!isLoading && !error && items.length > 0 && (
        <>
          <div className="space-y-3">
            {items.map((session, index) => (
              <SessionHistoryItem
                key={session.id}
                session={session}
                patientName={patientName}
                defaultExpanded={page === 1 && index === 0}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <nav
              className="mt-6 flex items-center justify-between gap-4"
              aria-label="Paginação do histórico"
            >
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-charcoal-muted transition hover:bg-slate-50 disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="text-xs text-charcoal-muted">
                Página {page} de {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasMore}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-charcoal-muted transition hover:bg-slate-50 disabled:opacity-40"
              >
                Próxima
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}
