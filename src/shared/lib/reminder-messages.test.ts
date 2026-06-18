import { describe, it, expect } from 'vitest';

/**
 * Espelha a lógica de mensagens da Edge Function (_shared/push-messages.ts)
 * para garantir variantes empáticas e não repetitivas.
 */
function firstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return 'seu filho(a)';
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

function reminderVariantSeed(userId: string, patientId: string, dayKey: string): number {
  let hash = 0;
  const str = `${userId}:${patientId}:${dayKey}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

const BODY_TEMPLATES = [
  'Como foi o dia do {name} hoje? Conta pra gente no diário de rotina!',
  'Sentimos sua falta no diário de {name}. Um relato rápido ajuda muito o terapeuta.',
];

function buildMessage(patientName: string, seed: number) {
  const name = firstName(patientName);
  const body = BODY_TEMPLATES[seed % BODY_TEMPLATES.length]!.replace(/{name}/g, name);
  return { body, name };
}

describe('reminder messages', () => {
  it('usa o primeiro nome da criança', () => {
    const { name, body } = buildMessage('Maria Clara Silva', 0);
    expect(name).toBe('Maria');
    expect(body).toContain('Maria');
  });

  it('varia mensagem por usuário e dia', () => {
    const a = reminderVariantSeed('user-a', 'patient-1', '2026-06-09');
    const b = reminderVariantSeed('user-b', 'patient-1', '2026-06-09');
    expect(a).not.toBe(b);
  });
});
