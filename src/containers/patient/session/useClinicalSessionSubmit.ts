import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAudioJobWatcher } from '@features/audio-recorder/useAudioJobWatcher';
import type { ClinicalSessionPayload } from './clinical-session.types';
import {
  getClinicalSessionProcessingLabel,
  submitClinicalSession,
  type ClinicalSessionSubmitPhase,
} from './clinical-session-submit.service';

export type ClinicalSessionSubmitState =
  | 'idle'
  | 'uploading'
  | 'processing'
  | 'error';

interface UseClinicalSessionSubmitOptions {
  patientId: string;
}

interface UseClinicalSessionSubmitResult {
  submit: (payload: ClinicalSessionPayload) => Promise<string>;
  state: ClinicalSessionSubmitState;
  error: string | null;
  isBusy: boolean;
  processingLabel: string | null;
  resetError: () => void;
}

export function useClinicalSessionSubmit({
  patientId,
}: UseClinicalSessionSubmitOptions): UseClinicalSessionSubmitResult {
  const queryClient = useQueryClient();
  const [state, setState] = useState<ClinicalSessionSubmitState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);
  const [activeInputMode, setActiveInputMode] = useState<ClinicalSessionPayload['input_mode']>();

  const resolveRef = useRef<((sessionNoteId: string) => void) | null>(null);
  const rejectRef = useRef<((reason: Error) => void) | null>(null);

  const notifyJobComplete = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['session-notes-draft', patientId] });
    void queryClient.invalidateQueries({ queryKey: ['patient-sessions', patientId] });
    window.dispatchEvent(
      new CustomEvent('ai-job-complete', { detail: { patient_id: patientId } }),
    );
  }, [patientId, queryClient]);

  useAudioJobWatcher({
    active: state === 'processing' && !!processingJobId,
    jobId: processingJobId,
    onCompleted: async (sessionNoteId) => {
      setState('idle');
      setProcessingJobId(null);
      notifyJobComplete();
      resolveRef.current?.(sessionNoteId);
      resolveRef.current = null;
      rejectRef.current = null;
    },
    onFailed: (reason) => {
      const message =
        reason === 'timeout'
          ? 'O processamento está demorando mais que o esperado. Confira "Revisão e aprovação" abaixo.'
          : 'A IA não conseguiu processar a sessão. Tente novamente.';
      setError(message);
      setState('error');
      setProcessingJobId(null);
      rejectRef.current?.(new Error(message));
      resolveRef.current = null;
      rejectRef.current = null;
    },
  });

  const submit = useCallback(
    async (payload: ClinicalSessionPayload): Promise<string> => {
      setError(null);
      setActiveInputMode(payload.input_mode);

      if (payload.input_mode === 'text') {
        setState('processing');
        try {
          const result = await submitClinicalSession(payload);
          if (result.kind !== 'sync') {
            throw new Error('Resposta inesperada do servidor.');
          }
          setState('idle');
          notifyJobComplete();
          return result.sessionNoteId;
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Não foi possível processar a sessão.';
          setError(message);
          setState('error');
          throw err;
        }
      }

      setState('uploading');
      try {
        const result = await submitClinicalSession(payload);
        if (result.kind !== 'async') {
          throw new Error('Resposta inesperada do servidor.');
        }

        setState('processing');
        setProcessingJobId(result.jobId);

        return await new Promise<string>((resolve, reject) => {
          resolveRef.current = resolve;
          rejectRef.current = reject;
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Não foi possível enviar a sessão.';
        setError(message);
        setState('error');
        setProcessingJobId(null);
        throw err;
      }
    },
    [notifyJobComplete],
  );

  const resetError = useCallback(() => {
    setError(null);
    if (state === 'error') {
      setState('idle');
    }
  }, [state]);

  const phase: ClinicalSessionSubmitPhase | null =
    state === 'uploading' ? 'uploading' : state === 'processing' ? 'processing' : null;

  const processingLabel =
    phase && activeInputMode
      ? getClinicalSessionProcessingLabel(phase, activeInputMode)
      : phase
        ? getClinicalSessionProcessingLabel(phase)
        : null;

  return {
    submit,
    state,
    error,
    isBusy: state === 'uploading' || state === 'processing',
    processingLabel,
    resetError,
  };
}
