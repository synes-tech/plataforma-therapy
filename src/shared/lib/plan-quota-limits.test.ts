/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { isQuotaExceeded, OFFICIAL_PLAN_LIMITS } from './plan-quota-limits';

describe('plan quota boundaries (crítico)', () => {
  it('bloqueia o 11º paciente no Plano Inicial (limite 10)', () => {
    const { patientsPerProf } = OFFICIAL_PLAN_LIMITS.inicial;
    expect(isQuotaExceeded(9, patientsPerProf)).toBe(false);
    expect(isQuotaExceeded(10, patientsPerProf)).toBe(true);
  });

  it('bloqueia o 41º paciente no Plano Intermediário (limite 40)', () => {
    const { patientsPerProf } = OFFICIAL_PLAN_LIMITS.intermediario;
    expect(isQuotaExceeded(39, patientsPerProf)).toBe(false);
    expect(isQuotaExceeded(40, patientsPerProf)).toBe(true);
  });

  it('bloqueia o 4º profissional no Clínica Starter (limite 3)', () => {
    const { professionals } = OFFICIAL_PLAN_LIMITS.starter;
    expect(isQuotaExceeded(2, professionals)).toBe(false);
    expect(isQuotaExceeded(3, professionals)).toBe(true);
  });

  it('Enterprise não aplica limite numérico', () => {
    expect(isQuotaExceeded(9999, OFFICIAL_PLAN_LIMITS.enterprise.professionals)).toBe(false);
    expect(isQuotaExceeded(9999, OFFICIAL_PLAN_LIMITS.enterprise.patientsPerProf)).toBe(false);
  });
});
