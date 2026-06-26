import { useEffect, useState } from 'react';
import { callPublicFunction } from '@shared/lib/api';
import { isInviteCodeComplete, normalizeInviteCodeInput } from './invite-code-preview.utils';

const PREVIEW_DEBOUNCE_MS = 350;

export type InvitePreviewStatus = 'idle' | 'loading' | 'valid' | 'invalid';

export interface InvitePreviewState {
  status: InvitePreviewStatus;
  patientName: string | null;
  relationship: string | null;
  error: string | null;
}

interface PreviewInviteResponse {
  patient_name: string;
  relationship: string;
}

const INITIAL_STATE: InvitePreviewState = {
  status: 'idle',
  patientName: null,
  relationship: null,
  error: null,
};

/**
 * Consulta assíncrona ao backend quando o código de convite está completo (8 chars).
 * Usado em todos os fluxos de vínculo familiar (cadastro, login+pós-login, inserir convite).
 */
export function useInviteCodePreview(code: string): InvitePreviewState & {
  isVerified: boolean;
  isChecking: boolean;
  normalizedCode: string;
} {
  const normalizedCode = normalizeInviteCodeInput(code);
  const [state, setState] = useState<InvitePreviewState>(INITIAL_STATE);

  useEffect(() => {
    if (!isInviteCodeComplete(normalizedCode)) {
      setState(INITIAL_STATE);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setState({
        status: 'loading',
        patientName: null,
        relationship: null,
        error: null,
      });

      try {
        const result = await callPublicFunction<PreviewInviteResponse>(
          'preview-invite',
          { code: normalizedCode },
          { signal: controller.signal },
        );

        if (controller.signal.aborted) return;

        setState({
          status: 'valid',
          patientName: result.patient_name,
          relationship: result.relationship,
          error: null,
        });
      } catch (err) {
        if (controller.signal.aborted) return;

        setState({
          status: 'invalid',
          patientName: null,
          relationship: null,
          error: err instanceof Error ? err.message : 'Não foi possível validar o convite.',
        });
      }
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [normalizedCode]);

  return {
    ...state,
    normalizedCode,
    isVerified: state.status === 'valid',
    isChecking: state.status === 'loading',
  };
}
