import { describe, expect, it } from 'vitest';
import {
  buildClinicalSessionPayload,
  finalizeClinicalSession,
  resolveClinicalInputMode,
} from './clinical-session-payload.utils';

describe('resolveClinicalInputMode', () => {
  it('retorna audio quando só há áudio', () => {
    expect(resolveClinicalInputMode(true, false)).toBe('audio');
  });

  it('retorna text quando só há texto', () => {
    expect(resolveClinicalInputMode(false, true)).toBe('text');
  });

  it('retorna dual quando há ambos', () => {
    expect(resolveClinicalInputMode(true, true)).toBe('dual');
  });
});

describe('buildClinicalSessionPayload — 3 cenários QA', () => {
  const patientId = '22222222-2222-4222-8222-222222222222';
  const scheduleId = '33333333-3333-4333-8333-333333333333';

  it('cenário 1: só áudio', () => {
    const blob = new Blob(['audio-data'], { type: 'audio/webm' });
    const payload = buildClinicalSessionPayload({
      patientId,
      scheduleId,
      anotacoesTexto: '',
      audioBlob: blob,
      audioDurationSeconds: 42,
    });

    expect(payload).not.toBeNull();
    expect(payload!.input_mode).toBe('audio');
    expect(payload!.anotacoes_texto).toBeUndefined();
    expect(payload!.audio_blob).toBe(blob);
    expect(payload!.audio_duration_seconds).toBe(42);
    expect(payload!.schedule_id).toBe(scheduleId);
  });

  it('cenário 2: só texto', () => {
    const text = 'Paciente colaborativo. Trabalhamos regulação emocional com apoio visual.';
    const payload = buildClinicalSessionPayload({
      patientId,
      anotacoesTexto: text,
    });

    expect(payload).not.toBeNull();
    expect(payload!.input_mode).toBe('text');
    expect(payload!.anotacoes_texto).toBe(text);
    expect(payload!.audio_blob).toBeUndefined();
  });

  it('cenário 3: áudio + texto (dual)', () => {
    const blob = new Blob(['audio-dual'], { type: 'audio/webm' });
    const text = 'Observação extra: mãe relatou melhora no sono.';
    const payload = buildClinicalSessionPayload({
      patientId,
      scheduleId,
      anotacoesTexto: text,
      audioBlob: blob,
      audioDurationSeconds: 90,
    });

    expect(payload).not.toBeNull();
    expect(payload!.input_mode).toBe('dual');
    expect(payload!.anotacoes_texto).toBe(text);
    expect(payload!.audio_blob).toBe(blob);
  });

  it('retorna null quando não há áudio nem texto', () => {
    expect(
      buildClinicalSessionPayload({
        patientId,
        anotacoesTexto: '   ',
        audioBlob: null,
      }),
    ).toBeNull();
  });
});

describe('finalizeClinicalSession', () => {
  it('agrupa payload dual intacto', () => {
    const blob = new Blob(['x'.repeat(2048)], { type: 'audio/webm' });
    const text = 'Parágrafo 1.\n\nParágrafo 2.\n\nParágrafo 3.';
    const result = finalizeClinicalSession({
      patientId: '22222222-2222-4222-8222-222222222222',
      anotacoesTexto: text,
      audioBlob: blob,
      audioDurationSeconds: 120,
    });

    expect(result).not.toBeNull();
    expect(result!.payload.input_mode).toBe('dual');
    expect(result!.payload.anotacoes_texto).toBe(text);
    expect(result!.payload.audio_blob?.size).toBe(2048);
    expect(result!.summary).toContain('dual');
    expect(result!.summary).toContain('Áudio: 2 KB');
  });
});
