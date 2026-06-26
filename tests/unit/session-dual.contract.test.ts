/**
 * @vitest-environment node
 * QA Fase 1 — contratos Sessão Dual (3 cenários de payload + prompts IA).
 */
import { describe, expect, it } from 'vitest';
import {
  buildAudioSoapPrompt,
  buildTextOnlySoapPrompt,
  resolveSessionInputMode,
} from '../../supabase/functions/_shared/session-report-prompts.ts';

function validateProcessAudioPayload(payload: unknown): {
  valid: boolean;
  hasAudio: boolean;
  hasText: boolean;
} {
  const p = payload as Record<string, unknown>;
  const hasAudio = typeof p.audio_recording_id === 'string' && typeof p.job_id === 'string';
  const text = p.anotacoes_texto;
  const hasText = typeof text === 'string' && text.trim().length > 0;
  const valid = hasAudio && typeof p.patient_id === 'string';
  return { valid, hasAudio, hasText };
}

function validateProcessSessionTextPayload(payload: unknown): boolean {
  const p = payload as Record<string, unknown>;
  const text = typeof p.anotacoes_texto === 'string' ? p.anotacoes_texto.trim() : '';
  return typeof p.patient_id === 'string' && text.length >= 10;
}

describe('Sessão Dual — input modes', () => {
  it('resolve audio-only', () => {
    expect(resolveSessionInputMode(true, false)).toBe('audio');
  });

  it('resolve text-only', () => {
    expect(resolveSessionInputMode(false, true)).toBe('text');
  });

  it('resolve dual', () => {
    expect(resolveSessionInputMode(true, true)).toBe('dual');
  });
});

describe('Sessão Dual — payloads (3 cenários QA)', () => {
  it('cenário 1: só áudio (legado)', () => {
    const payload = {
      audio_recording_id: '11111111-1111-4111-8111-111111111111',
      patient_id: '22222222-2222-4222-8222-222222222222',
      job_id: '33333333-3333-4333-8333-333333333333',
    };
    const result = validateProcessAudioPayload(payload);
    expect(result.valid).toBe(true);
    expect(result.hasAudio).toBe(true);
    expect(result.hasText).toBe(false);
    expect(resolveSessionInputMode(result.hasAudio, result.hasText)).toBe('audio');
  });

  it('cenário 2: só texto', () => {
    const payload = {
      patient_id: '22222222-2222-4222-8222-222222222222',
      anotacoes_texto: 'Paciente colaborativo. Trabalhamos regulação emocional com apoio visual.',
    };
    expect(validateProcessSessionTextPayload(payload)).toBe(true);
    expect(resolveSessionInputMode(false, true)).toBe('text');
  });

  it('cenário 3: áudio + anotações', () => {
    const payload = {
      audio_recording_id: '11111111-1111-4111-8111-111111111111',
      patient_id: '22222222-2222-4222-8222-222222222222',
      job_id: '33333333-3333-4333-8333-333333333333',
      anotacoes_texto: 'Observação extra: mãe relatou melhora no sono.',
    };
    const result = validateProcessAudioPayload(payload);
    expect(result.valid).toBe(true);
    expect(resolveSessionInputMode(result.hasAudio, result.hasText)).toBe('dual');
  });
});

describe('Sessão Dual — prompts IA', () => {
  it('prompt áudio puro não menciona anotações', () => {
    expect(buildAudioSoapPrompt(null)).toContain('ÁUDIO');
    expect(buildAudioSoapPrompt(null)).not.toContain('ANOTAÇÕES TEXTUAIS');
  });

  it('prompt dual menciona anotações', () => {
    const prompt = buildAudioSoapPrompt('Nota complementar');
    expect(prompt).toContain('ANOTAÇÕES TEXTUAIS');
    expect(prompt).toContain('Nota complementar');
  });

  it('prompt text-only usa anotações', () => {
    const prompt = buildTextOnlySoapPrompt('Sessão registrada por texto.');
    expect(prompt).toContain('APENAS por anotações textuais');
    expect(prompt).toContain('Sessão registrada por texto.');
  });
});
