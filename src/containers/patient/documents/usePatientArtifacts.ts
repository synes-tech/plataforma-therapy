import { useQuery } from '@tanstack/react-query';
import { callFunction } from '@shared/lib/api';
import type { PatientArtifactsResponse } from './patient-artifacts.types';

/** Carrega todos os artefatos do paciente; filtro por tipo é aplicado no cliente. */
export function usePatientArtifacts(patientId: string) {
  return useQuery({
    queryKey: ['patient-artifacts', patientId],
    queryFn: () =>
      callFunction<PatientArtifactsResponse>('get-patient-artifacts', {
        patient_id: patientId,
        filtro_tipo: 'todos',
      }),
    enabled: !!patientId,
    staleTime: 30_000,
  });
}
