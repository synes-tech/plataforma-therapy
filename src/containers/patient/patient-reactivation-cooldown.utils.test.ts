/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  REACTIVATION_COOLDOWN_DAYS,
  formatCooldownBadge,
  getReactivationCooldownStatus,
} from './patient-reactivation-cooldown.utils';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

describe('patient-reactivation-cooldown.utils', () => {
  it('permite reativação sem data de desvínculo (legado)', () => {
    const status = getReactivationCooldownStatus(null);
    expect(status.canReactivate).toBe(true);
    expect(status.daysRemaining).toBe(0);
  });

  it('bloqueia paciente desvinculado há 2 dias', () => {
    const now = Date.parse('2026-06-09T12:00:00.000Z');
    const unlinked = new Date(now - 2 * MS_PER_DAY).toISOString();
    const status = getReactivationCooldownStatus(unlinked, now);
    expect(status.canReactivate).toBe(false);
    expect(status.daysRemaining).toBeGreaterThanOrEqual(1);
    expect(status.daysRemaining).toBeLessThanOrEqual(REACTIVATION_COOLDOWN_DAYS);
  });

  it('libera após 30 dias completos', () => {
    const now = Date.parse('2026-07-10T12:00:00.000Z');
    const unlinked = new Date(now - 30 * MS_PER_DAY).toISOString();
    const status = getReactivationCooldownStatus(unlinked, now);
    expect(status.canReactivate).toBe(true);
    expect(status.daysRemaining).toBe(0);
  });

  it('não exibe 0 dias enquanto ainda bloqueado', () => {
    const now = Date.parse('2026-06-09T23:59:00.000Z');
    const unlinked = new Date(now - 29 * MS_PER_DAY).toISOString();
    const status = getReactivationCooldownStatus(unlinked, now);
    expect(status.canReactivate).toBe(false);
    expect(status.daysRemaining).toBeGreaterThanOrEqual(1);
  });

  it('formata badge de bloqueio', () => {
    const blocked = getReactivationCooldownStatus(
      new Date(Date.now() - 2 * MS_PER_DAY).toISOString(),
    );
    if (!blocked.canReactivate) {
      expect(formatCooldownBadge(blocked)).toMatch(/Bloqueado\. Libera em \d+ dia/);
    }
  });
});
