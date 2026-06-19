import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import type { ArtifactFilterValue, PatientArtifactsResponse } from './patient-artifacts.types';

export function usePatientArtifacts(patientId: string, filter: ArtifactFilterValue) {
  return useQuery({
    queryKey: ['patient-artifacts', patientId, filter],
    queryFn: () =>
      callFunction<PatientArtifactsResponse>('get-patient-artifacts', {
        patient_id: patientId,
        filtro_tipo: filter,
      }),
    enabled: !!patientId,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}
