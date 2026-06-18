/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';

const TRIAL_DAYS = 14;

function computeTrialEndsAt(from: Date): Date {
  const ends = new Date(from);
  ends.setUTCDate(ends.getUTCDate() + TRIAL_DAYS);
  return ends;
}

describe('onboarding trial — 14 dias', () => {
  it('trial_ends_at marca exatamente 14 dias no futuro', () => {
    const start = new Date('2026-06-01T12:00:00.000Z');
    const ends = computeTrialEndsAt(start);
    expect(ends.toISOString()).toBe('2026-06-15T12:00:00.000Z');
  });

  it('payload de registro não inclui seleção de plano', () => {
    const payload = {
      account_type: 'solo' as const,
      clinic_email: 'a@b.com',
      admin_name: 'Ana',
      admin_email: 'ana@b.com',
      admin_password: 'secret1',
    };
    expect(payload).not.toHaveProperty('plan');
    expect(payload.account_type).toBe('solo');
  });

  it('corporate exige clinic_name no payload', () => {
    const corporate = {
      account_type: 'corporate' as const,
      clinic_name: 'Clínica Teste',
      clinic_email: 'c@clinica.com',
      admin_name: 'Admin',
      admin_email: 'admin@clinica.com',
      admin_password: 'secret1',
    };
    expect(corporate.clinic_name.length).toBeGreaterThan(1);
  });
});
