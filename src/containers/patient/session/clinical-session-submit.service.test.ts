/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClinicalSessionPayload } from './clinical-session.types';

vi.mock('@shared/lib/api', () => ({
  callFunction: vi.fn(),
}));

vi.mock('@shared/lib/audio-wav', () => ({
  blobToWav: vi.fn(async (blob: Blob) => blob),
}));

import { callFunction } from '@shared/lib/api';
import {
  getClinicalSessionProcessingLabel,
  submitClinicalSession,
  submitClinicalSessionAudio,
  submitClinicalSessionText,
} from './clinical-session-submit.service';

const mockedCallFunction = vi.mocked(callFunction);

describe('clinical-session-submit.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true }),
    );
  });

  const patientId = '22222222-2222-4222-8222-222222222222';
  const scheduleId = '33333333-3333-4333-8333-333333333333';

  it('submitClinicalSessionText chama process-session-text', async () => {
    mockedCallFunction.mockResolvedValueOnce({
      session_note_id: 'note-text-1',
      job_id: 'job-text-1',
      input_mode: 'text',
    });

    const payload: ClinicalSessionPayload = {
      patient_id: patientId,
      schedule_id: scheduleId,
      input_mode: 'text',
      anotacoes_texto: 'Sessão registrada apenas por texto clínico.',
    };

    const result = await submitClinicalSessionText(payload);

    expect(result.sessionNoteId).toBe('note-text-1');
    expect(mockedCallFunction).toHaveBeenCalledWith('process-session-text', {
      patient_id: patientId,
      anotacoes_texto: payload.anotacoes_texto,
      schedule_id: scheduleId,
    });
  });

  it('submitClinicalSessionAudio faz upload + process-audio', async () => {
    mockedCallFunction
      .mockResolvedValueOnce({
        audio_recording_id: 'rec-1',
        upload_url: 'https://storage.example/upload',
        job_id: 'job-audio-1',
      })
      .mockResolvedValueOnce({ ok: true });

    const blob = new Blob(['audio'], { type: 'audio/webm' });
    const payload: ClinicalSessionPayload = {
      patient_id: patientId,
      input_mode: 'audio',
      audio_blob: blob,
      audio_duration_seconds: 10,
    };

    const result = await submitClinicalSessionAudio(payload);

    expect(result.jobId).toBe('job-audio-1');
    expect(mockedCallFunction).toHaveBeenNthCalledWith(1, 'upload-audio', {
      patient_id: patientId,
      recording_type: 'post_session',
      duration_seconds: 10,
    });
    expect(mockedCallFunction).toHaveBeenNthCalledWith(2, 'process-audio', {
      audio_recording_id: 'rec-1',
      patient_id: patientId,
      job_id: 'job-audio-1',
    });
    expect(fetch).toHaveBeenCalled();
  });

  it('submitClinicalSessionAudio dual inclui anotacoes_texto', async () => {
    mockedCallFunction
      .mockResolvedValueOnce({
        audio_recording_id: 'rec-dual',
        upload_url: 'https://storage.example/upload',
        job_id: 'job-dual',
      })
      .mockResolvedValueOnce({ ok: true });

    const payload: ClinicalSessionPayload = {
      patient_id: patientId,
      input_mode: 'dual',
      anotacoes_texto: 'Complemento digitado ao vivo.',
      audio_blob: new Blob(['audio'], { type: 'audio/webm' }),
      audio_duration_seconds: 12,
    };

    await submitClinicalSessionAudio(payload);

    expect(mockedCallFunction).toHaveBeenNthCalledWith(2, 'process-audio', {
      audio_recording_id: 'rec-dual',
      patient_id: patientId,
      job_id: 'job-dual',
      anotacoes_texto: 'Complemento digitado ao vivo.',
    });
  });

  it('submitClinicalSession roteia text como sync e audio como async', async () => {
    mockedCallFunction.mockResolvedValueOnce({
      session_note_id: 'note-sync',
      job_id: 'job-sync',
      input_mode: 'text',
    });

    const textResult = await submitClinicalSession({
      patient_id: patientId,
      input_mode: 'text',
      anotacoes_texto: 'Texto clínico suficiente para IA.',
    });
    expect(textResult).toEqual({
      kind: 'sync',
      sessionNoteId: 'note-sync',
      jobId: 'job-sync',
    });

    mockedCallFunction
      .mockResolvedValueOnce({
        audio_recording_id: 'rec-async',
        upload_url: 'https://storage.example/upload',
        job_id: 'job-async',
      })
      .mockResolvedValueOnce({ ok: true });

    const audioResult = await submitClinicalSession({
      patient_id: patientId,
      input_mode: 'audio',
      audio_blob: new Blob(['x'], { type: 'audio/webm' }),
    });
    expect(audioResult).toEqual({ kind: 'async', jobId: 'job-async' });
  });

  it('getClinicalSessionProcessingLabel retorna mensagens por modo', () => {
    expect(getClinicalSessionProcessingLabel('uploading')).toContain('Enviando áudio');
    expect(getClinicalSessionProcessingLabel('processing', 'dual')).toContain('mesclando');
    expect(getClinicalSessionProcessingLabel('processing', 'text')).toContain('anotações');
  });
});
