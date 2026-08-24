import { describe, expect, it } from 'vitest';
import {
  clinicSettingsUsageFallback,
  formatPatientQuotaLabel,
  patientQuotaModalHint,
  patientQuotaRemaining,
  patientQuotaTone,
  resolvePatientQuotaForViewer,
  shouldShowPatientQuotaChip,
} from './patient-quota-chip.utils';

describe('cota de pacientes na lista', () => {
  it('formata o uso e as vagas restantes', () => {
    expect(formatPatientQuotaLabel(18, 30)).toBe('18 / 30');
    expect(patientQuotaRemaining(18, 30)).toBe(12);
    expect(patientQuotaRemaining(30, 30)).toBe(0);
    expect(shouldShowPatientQuotaChip(30)).toBe(true);
    expect(shouldShowPatientQuotaChip(0)).toBe(false);
  });

  it('marca aviso perto do limite e cheio no teto', () => {
    expect(patientQuotaTone(10, 30)).toBe('ok');
    expect(patientQuotaTone(24, 30)).toBe('warn');
    expect(patientQuotaTone(30, 30)).toBe('full');
    expect(patientQuotaTone(31, 30)).toBe('full');
  });

  it('explica as duas saídas no modal conforme a cota', () => {
    expect(patientQuotaModalHint('warn', true)).toMatch(/\+5 pacientes/i);
    expect(patientQuotaModalHint('full', false)).toMatch(/Mude de plano/i);
    expect(patientQuotaModalHint('ok', true)).toMatch(/\+5 pacientes/i);
  });

  it('mostra a cota para admin mesmo sem payload da API', () => {
    const resolved = resolvePatientQuotaForViewer({
      isAdminViewer: true,
      planId: 'premium',
      quota: null,
      settingsFallback: { activeCount: 18, quotaBonus: 0, planId: 'premium' },
    });
    expect(resolved?.total_limit).toBe(30);
    expect(resolved?.active_count).toBe(18);
    expect(shouldShowPatientQuotaChip(resolved?.total_limit)).toBe(true);
  });

  it('substitui limite zerado da conta isenta pelo catálogo para admin', () => {
    const resolved = resolvePatientQuotaForViewer({
      isAdminViewer: true,
      planId: 'premium',
      quota: {
        plan_base_limit: 0,
        quota_bonus: 0,
        total_limit: 0,
        active_count: 18,
        addon: null,
      },
    });
    expect(resolved?.total_limit).toBe(30);
    expect(resolved?.active_count).toBe(18);
  });

  it('não sintetiza cota para profissional sem payload', () => {
    expect(
      resolvePatientQuotaForViewer({
        isAdminViewer: false,
        planId: 'premium',
        quota: null,
      }),
    ).toBeNull();
  });

  it('espera o plano da clínica antes de sintetizar cota de admin', () => {
    expect(
      resolvePatientQuotaForViewer({
        isAdminViewer: true,
        quota: null,
      }),
    ).toBeNull();
  });

  it('lê o uso ativo do payload de configurações da clínica', () => {
    expect(
      clinicSettingsUsageFallback({
        clinic: { subscription_plan: 'premium' },
        resource_usage: {
          active_patients_clinic_total: 12,
          owner_is_professional: false,
          patient_quota_bonus: 5,
        },
      }),
    ).toEqual({ planId: 'premium', activeCount: 12, quotaBonus: 5 });
  });
});
