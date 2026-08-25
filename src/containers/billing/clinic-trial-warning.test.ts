/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { clinicTrialIn24hWindow } from '../../../supabase/functions/_shared/clinic-trial-warning.ts';

describe('clinicTrialIn24hWindow', () => {
  const now = new Date('2026-09-06T16:00:00.000Z');

  it('entra na janela de 24 horas', () => {
    expect(clinicTrialIn24hWindow(new Date('2026-09-07T16:00:00.000Z'), now)).toBe(true);
  });

  it('rejeita quando falta mais de 25 horas ou menos de 23', () => {
    expect(clinicTrialIn24hWindow(new Date('2026-09-08T16:00:00.000Z'), now)).toBe(false);
    expect(clinicTrialIn24hWindow(new Date('2026-09-07T12:00:00.000Z'), now)).toBe(false);
  });
});
