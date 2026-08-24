import type {
  CompanionDoneMeta,
  CompanionHistoryRow,
  CompanionRiskLevel,
  PatientChatMessage,
} from './patient-chat.types';

export const COMPANION_EMERGENCY_HOTLINES = [
  {
    id: 'cvv',
    label: 'CVV',
    number: '188',
    href: 'tel:188',
    hint: '24 horas, gratuito e sigiloso',
  },
  {
    id: 'samu',
    label: 'SAMU',
    number: '192',
    href: 'tel:192',
    hint: 'Emergência médica',
  },
] as const;

export function isCompanionRiskLevel(value: unknown): value is CompanionRiskLevel {
  return value === 'LOW' || value === 'MODERATE' || value === 'SEVERE';
}

/**
 * A UI não decide risco. Metadado do servidor manda.
 * O texto com 188/CVV é só rede de segurança se o stream cair no meio do protocolo.
 */
export function isEmergencyMessage(input: {
  risk_level?: string | null;
  emergency_protocol_shown?: boolean | null;
  content?: string | null;
}): boolean {
  if (input.emergency_protocol_shown === true) return true;
  if (input.risk_level === 'SEVERE') return true;
  return containsEmergencyHotline(input.content ?? '');
}

export function containsEmergencyHotline(content: string): boolean {
  if (!content) return false;
  const hasCvv = /\b188\b/.test(content) && /CVV|ligue/i.test(content);
  const hasSamu = /\b192\b/.test(content) && /SAMU/i.test(content);
  return hasCvv || hasSamu;
}

export function companionMetaFromDone(event: Record<string, unknown>): CompanionDoneMeta {
  return {
    answer: typeof event.answer === 'string' ? event.answer : '',
    risk_level: isCompanionRiskLevel(event.risk_level) ? event.risk_level : null,
    emergency_protocol_shown: event.emergency_protocol_shown === true,
    thread_id: typeof event.thread_id === 'string' ? event.thread_id : null,
    message_id: typeof event.message_id === 'string' ? event.message_id : null,
    detector: typeof event.detector === 'string' ? event.detector : null,
  };
}

export function historyRowToMessage(row: CompanionHistoryRow): PatientChatMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    inputSource: row.input_source === 'audio' ? 'audio' : 'text',
    riskLevel: isCompanionRiskLevel(row.risk_level) ? row.risk_level : undefined,
    emergencyProtocolShown: row.emergency_protocol_shown === true,
    createdAt: row.created_at,
  };
}

export function formatRecordingClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function normalizeCompanionAudioMime(
  mime: string,
): 'audio/webm' | 'audio/mp4' | 'audio/mpeg' | 'audio/wav' | 'audio/ogg' {
  if (mime.includes('webm')) return 'audio/webm';
  if (mime.includes('mp4') || mime.includes('aac')) return 'audio/mp4';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'audio/mpeg';
  if (mime.includes('wav')) return 'audio/wav';
  if (mime.includes('ogg')) return 'audio/ogg';
  return 'audio/webm';
}

export function trimCompanionDraft(value: string, max = 2000): string {
  return value.trim().slice(0, max);
}
