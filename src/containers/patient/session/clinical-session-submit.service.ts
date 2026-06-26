import { callFunction } from '@shared/lib/api';
import { blobToWav } from '@shared/lib/audio-wav';
import type { ClinicalSessionPayload } from './clinical-session.types';

export type ClinicalSessionSubmitPhase = 'uploading' | 'processing';

export interface SubmitClinicalSessionAudioResult {
  jobId: string;
  audioRecordingId: string;
}

export interface SubmitClinicalSessionTextResult {
  sessionNoteId: string;
  jobId: string;
}

function assertAudioPayload(payload: ClinicalSessionPayload): asserts payload is ClinicalSessionPayload & {
  audio_blob: Blob;
} {
  if (!payload.audio_blob || payload.audio_blob.size === 0) {
    throw new Error('Áudio ausente no payload.');
  }
}

function assertTextPayload(payload: ClinicalSessionPayload): asserts payload is ClinicalSessionPayload & {
  anotacoes_texto: string;
} {
  if (!payload.anotacoes_texto?.trim()) {
    throw new Error('Anotações textuais ausentes no payload.');
  }
}

/** Envia áudio (modo audio ou dual) → dispara process-audio assíncrono. */
export async function submitClinicalSessionAudio(
  payload: ClinicalSessionPayload,
): Promise<SubmitClinicalSessionAudioResult> {
  assertAudioPayload(payload);

  const upload = await callFunction<{
    audio_recording_id: string;
    upload_url: string;
    job_id: string;
  }>('upload-audio', {
    patient_id: payload.patient_id,
    recording_type: 'post_session',
    duration_seconds: payload.audio_duration_seconds ?? 0,
    ...(payload.schedule_id ? { schedule_id: payload.schedule_id } : {}),
  });

  const wavBlob = await blobToWav(payload.audio_blob);
  const uploadResponse = await fetch(upload.upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': 'audio/wav' },
    body: wavBlob,
  });

  if (!uploadResponse.ok) {
    throw new Error('Falha ao enviar o áudio. Tente novamente.');
  }

  await callFunction('process-audio', {
    audio_recording_id: upload.audio_recording_id,
    patient_id: payload.patient_id,
    job_id: upload.job_id,
    ...(payload.anotacoes_texto?.trim()
      ? { anotacoes_texto: payload.anotacoes_texto.trim() }
      : {}),
  });

  return {
    jobId: upload.job_id,
    audioRecordingId: upload.audio_recording_id,
  };
}

/** Envia somente texto → process-session-text síncrono (retorna session_note_id). */
export async function submitClinicalSessionText(
  payload: ClinicalSessionPayload,
): Promise<SubmitClinicalSessionTextResult> {
  assertTextPayload(payload);

  const result = await callFunction<{
    session_note_id: string;
    job_id: string;
    input_mode: string;
  }>('process-session-text', {
    patient_id: payload.patient_id,
    anotacoes_texto: payload.anotacoes_texto.trim(),
    ...(payload.schedule_id ? { schedule_id: payload.schedule_id } : {}),
  });

  return {
    sessionNoteId: result.session_note_id,
    jobId: result.job_id,
  };
}

/** Roteia payload para o endpoint correto conforme input_mode. */
export async function submitClinicalSession(
  payload: ClinicalSessionPayload,
): Promise<
  | { kind: 'async'; jobId: string }
  | { kind: 'sync'; sessionNoteId: string; jobId: string }
> {
  if (payload.input_mode === 'text') {
    const result = await submitClinicalSessionText(payload);
    return { kind: 'sync', sessionNoteId: result.sessionNoteId, jobId: result.jobId };
  }

  const result = await submitClinicalSessionAudio(payload);
  return { kind: 'async', jobId: result.jobId };
}

export function getClinicalSessionProcessingLabel(
  phase: ClinicalSessionSubmitPhase,
  inputMode?: ClinicalSessionPayload['input_mode'],
): string {
  if (phase === 'uploading') {
    return 'Enviando áudio com segurança…';
  }

  if (inputMode === 'text') {
    return 'IA estruturando relatório a partir das anotações…';
  }

  if (inputMode === 'dual') {
    return 'IA mesclando áudio e anotações textuais…';
  }

  return 'IA transcrevendo e estruturando o relatório…';
}
