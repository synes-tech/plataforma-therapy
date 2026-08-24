import { describe, expect, it } from 'vitest';
import {
  COMPANION_EMERGENCY_HOTLINES,
  companionMetaFromDone,
  containsEmergencyHotline,
  formatRecordingClock,
  historyRowToMessage,
  isCompanionRiskLevel,
  isEmergencyMessage,
  normalizeCompanionAudioMime,
  trimCompanionDraft,
} from './patient-chat.utils';

describe('isEmergencyMessage', () => {
  it('prioriza o metadado do servidor, não o texto', () => {
    expect(isEmergencyMessage({ emergency_protocol_shown: true, content: 'oi' })).toBe(true);
    expect(isEmergencyMessage({ risk_level: 'SEVERE', content: 'respire comigo' })).toBe(true);
    expect(isEmergencyMessage({ risk_level: 'LOW', emergency_protocol_shown: false, content: 'oi' })).toBe(false);
  });

  it('não trata "morrer de vergonha" como emergência', () => {
    expect(
      isEmergencyMessage({
        risk_level: 'LOW',
        content: 'vou morrer de vergonha na reunião',
      }),
    ).toBe(false);
  });

  it('reconhece o protocolo no texto se o stream cair no meio', () => {
    expect(
      containsEmergencyHotline('Ligue 188 no CVV agora. Se precisar, SAMU 192.'),
    ).toBe(true);
    expect(containsEmergencyHotline('tenho 188 reais na conta')).toBe(false);
  });
});

describe('companionMetaFromDone', () => {
  it('preserva risk_level e emergency_protocol_shown do NDJSON B2C', () => {
    const meta = companionMetaFromDone({
      type: 'done',
      answer: 'Estou aqui.',
      risk_level: 'MODERATE',
      emergency_protocol_shown: false,
      thread_id: 'thread-1',
      message_id: 'msg-9',
      detector: 'classifier',
    });

    expect(meta.answer).toBe('Estou aqui.');
    expect(meta.risk_level).toBe('MODERATE');
    expect(meta.emergency_protocol_shown).toBe(false);
    expect(meta.thread_id).toBe('thread-1');
    expect(meta.message_id).toBe('msg-9');
  });

  it('ignora risk_level inválido em vez de inventar SEVERE', () => {
    const meta = companionMetaFromDone({
      type: 'done',
      answer: 'ok',
      risk_level: 'CRITICAL',
      emergency_protocol_shown: 'yes',
    });
    expect(meta.risk_level).toBeNull();
    expect(meta.emergency_protocol_shown).toBe(false);
  });
});

describe('hotlines e histórico', () => {
  it('expõe só 188 e 192', () => {
    expect(COMPANION_EMERGENCY_HOTLINES.map((item) => item.href)).toEqual(['tel:188', 'tel:192']);
    expect(COMPANION_EMERGENCY_HOTLINES.map((item) => item.number)).toEqual(['188', '192']);
  });

  it('mapeia linha do banco para a bolha do chat', () => {
    const message = historyRowToMessage({
      id: 'm1',
      role: 'assistant',
      content: 'Vamos respirar juntos.',
      input_source: 'text',
      risk_level: 'MODERATE',
      emergency_protocol_shown: false,
      created_at: '2026-08-22T12:00:00.000Z',
    });
    expect(message.riskLevel).toBe('MODERATE');
    expect(message.emergencyProtocolShown).toBe(false);
    expect(isCompanionRiskLevel(message.riskLevel)).toBe(true);
  });

  it('formata o relógio da gravação e o mime do áudio', () => {
    expect(formatRecordingClock(0)).toBe('0:00');
    expect(formatRecordingClock(72)).toBe('1:12');
    expect(normalizeCompanionAudioMime('audio/webm;codecs=opus')).toBe('audio/webm');
    expect(normalizeCompanionAudioMime('audio/mp4')).toBe('audio/mp4');
  });

  it('corta o rascunho no limite da API', () => {
    expect(trimCompanionDraft(`  ${'a'.repeat(2100)}  `)).toHaveLength(2000);
    expect(trimCompanionDraft('   ')).toBe('');
  });
});
