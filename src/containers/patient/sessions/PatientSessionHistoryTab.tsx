import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingOverlay } from '@containers/loading';
import { RecordEmptyState } from '../RecordEmptyState';
import { RecordSessionButton } from '../RecordSessionButton';
import type { PatientSessionRecord } from '../session/session-history.types';
import { PatientSessionReadModal } from './PatientSessionReadModal';
import { PatientSessionsTable } from './PatientSessionsTable';
import { PatientSessionsTableSkeleton } from './PatientSessionsTableSkeleton';
import { usePatientSessions } from './usePatientSessions';

interface PatientSessionHistoryTabProps {
  patientId: string;
  patientName: string;
}

export function PatientSessionHistoryTab({ patientId, patientName }: PatientSessionHistoryTabProps) {
  const navigate = useNavigate();
  const [readingSession, setReadingSession] = useState<PatientSessionRecord | null>(null);
  const { data, isPending, isFetching, error, refetch } = usePatientSessions(patientId);

  const items = data?.items ?? [];
  const totalCount = data?.total_count ?? 0;
  const showInitialSkeleton = !data && (isPending || isFetching);
  const showRefetchOverlay = !!data && isFetching;
  const showEmpty = !showInitialSkeleton && !error && items.length === 0;

  return (
    <div className="space-y-3">
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-error/10 bg-error-light/50 px-4 py-3 text-sm text-error"
        >
          <p>Não foi possível carregar o histórico de sessões.</p>
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
        <PatientSessionsTableSkeleton />
      ) : showEmpty ? (
        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
          <RecordEmptyState
            variant="sessions"
            action={
              <RecordSessionButton
                variant="empty"
                onClick={() => navigate(`/session/${patientId}`)}
              />
            }
          />
        </div>
      ) : !error ? (
        <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <LoadingOverlay show={showRefetchOverlay} label="Atualizando sessões..." />

          <div className="border-b border-slate-100 px-4 py-2.5 sm:px-5">
            <p className="text-xs text-charcoal-muted">
              <span className="font-medium text-charcoal">{totalCount || items.length}</span>{' '}
              {(totalCount || items.length) === 1 ? 'sessão registrada' : 'sessões registradas'}
            </p>
          </div>

          <PatientSessionsTable items={items} onView={setReadingSession} />
        </div>
      ) : null}

      <PatientSessionReadModal
        session={readingSession}
        patientName={patientName}
        onClose={() => setReadingSession(null)}
      />
    </div>
  );
}
