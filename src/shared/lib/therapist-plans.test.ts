/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  isSoloSubscriptionPlan,
  isTherapistPlan,
  therapistPlanPatientLimit,
  THERAPIST_PLAN_LIMITS,
  THERAPIST_PLANS,
  PATIENT_ADDON_MODULES,
  addonModuleForPlan,
  effectivePatientLimit,
  computeAudioMinutesLimit,
  yearlyTotalCents,
  yearlySavingsCents,
  costPerPatientCents,
} from './therapist-plans';

describe('therapist-plans (catálogo v2)', () => {
  it('identifica planos do terapeuta autônomo', () => {
    expect(isTherapistPlan('free')).toBe(true);
    expect(isTherapistPlan('standard')).toBe(true);
    expect(isTherapistPlan('advanced')).toBe(true);
    expect(isTherapistPlan('premium')).toBe(true);
    expect(isTherapistPlan('starter')).toBe(false);
  });

  it('aceita legado como solo', () => {
    expect(isSoloSubscriptionPlan('consultorio')).toBe(true);
    expect(isSoloSubscriptionPlan('inicial')).toBe(true);
    expect(isSoloSubscriptionPlan('intermediario')).toBe(true);
  });

  it('expõe limites oficiais de pacientes', () => {
    expect(THERAPIST_PLAN_LIMITS.free).toBe(1);
    expect(THERAPIST_PLAN_LIMITS.standard).toBe(10);
    expect(THERAPIST_PLAN_LIMITS.advanced).toBe(20);
    expect(THERAPIST_PLAN_LIMITS.premium).toBe(30);
    expect(therapistPlanPatientLimit('inicial')).toBe(10);
    expect(therapistPlanPatientLimit('intermediario')).toBe(40);
  });

  it('preços oficiais em centavos', () => {
    expect(THERAPIST_PLANS.free.monthlyCents).toBe(0);
    expect(THERAPIST_PLANS.standard.monthlyCents).toBe(23700);
    expect(THERAPIST_PLANS.advanced.monthlyCents).toBe(42700);
    expect(THERAPIST_PLANS.premium.monthlyCents).toBe(65700);
    expect(THERAPIST_PLANS.standard.yearlyMonthlyCents).toBe(20700);
    expect(THERAPIST_PLANS.advanced.yearlyMonthlyCents).toBe(37700);
    expect(THERAPIST_PLANS.premium.yearlyMonthlyCents).toBe(57700);
  });

  it('limites de sessões = pacientes × 4', () => {
    for (const plan of Object.values(THERAPIST_PLANS)) {
      expect(plan.sessionLimit).toBe(plan.patientLimit * 4);
    }
  });

  it('duração de sessão: 50 min no free, 60 nos pagos', () => {
    expect(THERAPIST_PLANS.free.sessionDurationMin).toBe(50);
    expect(THERAPIST_PLANS.standard.sessionDurationMin).toBe(60);
    expect(THERAPIST_PLANS.premium.sessionDurationMin).toBe(60);
  });

  it('minutos de áudio = sessões × duração × 1,3', () => {
    expect(THERAPIST_PLANS.free.audioMinutesPerMonth).toBe(260);
    expect(THERAPIST_PLANS.standard.audioMinutesPerMonth).toBe(3120);
    expect(THERAPIST_PLANS.advanced.audioMinutesPerMonth).toBe(6240);
    expect(THERAPIST_PLANS.premium.audioMinutesPerMonth).toBe(9360);
    expect(computeAudioMinutesLimit(120, 60)).toBe(9360);
    expect(PATIENT_ADDON_MODULES.modulo_sa.audioBonusMinutes).toBe(1560);
  });

  it('módulo adicional aplicável por plano', () => {
    expect(addonModuleForPlan('standard')?.id).toBe('modulo_sa');
    expect(addonModuleForPlan('advanced')?.id).toBe('modulo_sa');
    expect(addonModuleForPlan('premium')?.id).toBe('modulo_p');
    expect(addonModuleForPlan('free')).toBe(null);
    expect(PATIENT_ADDON_MODULES.modulo_sa.monthlyCents).toBe(12943);
    expect(PATIENT_ADDON_MODULES.modulo_p.monthlyCents).toBe(10632);
  });

  it('ciclo anual: total e economia', () => {
    expect(yearlyTotalCents(THERAPIST_PLANS.standard)).toBe(20700 * 12);
    expect(yearlySavingsCents(THERAPIST_PLANS.standard)).toBe((23700 - 20700) * 12);
    expect(yearlyTotalCents(THERAPIST_PLANS.free)).toBe(null);
  });

  it('custo por paciente = preço do plano ÷ teto de pacientes', () => {
    expect(costPerPatientCents(23700, 10)).toBe(2370);
    expect(costPerPatientCents(20700, 10)).toBe(2070);
    expect(costPerPatientCents(57700, 30)).toBe(1923);
    expect(costPerPatientCents(10000, 0)).toBe(0);
  });

  it('soma bônus de upsell ao limite base', () => {
    expect(effectivePatientLimit(10, 5)).toBe(15);
    expect(effectivePatientLimit(30, 10)).toBe(40);
    expect(effectivePatientLimit(null, 10)).toBe(null);
  });
});
