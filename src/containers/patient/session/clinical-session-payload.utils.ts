import type {
  ClinicalSessionFinalizeResult,
  ClinicalSessionInputMode,
  ClinicalSessionPayload,
} from './clinical-session.types';

export function resolveClinicalInputMode(
  hasAudio: boolean,
  hasText: boolean,
): ClinicalSessionInputMode {
  if (hasAudio && hasText) return 'dual';
  if (hasAudio) return 'audio';
  return 'text';
}

export function buildClinicalSessionPayload(params: {
  patientId: string;
  scheduleId?: string;
  anotacoesTexto: string;
  audioBlob?: Blob | null;
  audioDurationSeconds?: number;
}): ClinicalSessionPayload | null {
  const text = params.anotacoesTexto.trim();
  const hasText = text.length > 0;
  const hasAudio = !!params.audioBlob && params.audioBlob.size > 0;

  if (!hasText && !hasAudio) return null;

  const inputMode = resolveClinicalInputMode(hasAudio, hasText);

  return {
    patient_id: params.patientId,
    ...(params.scheduleId ? { schedule_id: params.scheduleId } : {}),
    input_mode: inputMode,
    ...(hasText ? { anotacoes_texto: text } : {}),
    ...(hasAudio
      ? {
          audio_blob: params.audioBlob!,
          audio_duration_seconds: params.audioDurationSeconds ?? 0,
          audio_mime_type: params.audioBlob!.type || 'audio/webm',
        }
      : {}),
  };
}

export function describeClinicalSessionPayload(payload: ClinicalSessionPayload): string {
  const parts: string[] = [`Modo: ${payload.input_mode}`];
  if (payload.anotacoes_texto) {
    parts.push(`Texto: ${payload.anotacoes_texto.length} caracteres`);
  }
  if (payload.audio_blob) {
    parts.push(`Áudio: ${Math.round(payload.audio_blob.size / 1024)} KB`);
  }
  return parts.join(' · ');
}

export function finalizeClinicalSession(params: {
  patientId: string;
  scheduleId?: string;
  anotacoesTexto: string;
  audioBlob?: Blob | null;
  audioDurationSeconds?: number;
}): ClinicalSessionFinalizeResult | null {
  const payload = buildClinicalSessionPayload(params);
  if (!payload) return null;

  return {
    payload,
    summary: describeClinicalSessionPayload(payload),
  };
}
