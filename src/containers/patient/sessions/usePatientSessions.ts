import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import type { PatientSessionsResponse } from '../session/session-history.types';

const PAGE_SIZE = 50;

export function usePatientSessions(patientId: string) {
  const query = useQuery({
    queryKey: ['patient-sessions', patientId, 'history-tab'],
    queryFn: () =>
      callFunction<PatientSessionsResponse>('get-patient-sessions', {
        patient_id: patientId,
        page: 1,
        page_size: PAGE_SIZE,
      }),
    enabled: !!patientId,
    staleTime: 60_000,
  });

  useEffect(() => {
    function onJobComplete() {
      void query.refetch();
    }
    window.addEventListener('ai-job-complete', onJobComplete);
    return () => window.removeEventListener('ai-job-complete', onJobComplete);
  }, [query.refetch]);

  return query;
}
