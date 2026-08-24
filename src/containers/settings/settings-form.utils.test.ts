/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  clinicSettingsToFormState,
  isSettingsFormDirty,
  patientUsagePercent,
  unwrapClinicSettings,
} from './settings-form.utils';

const payload = {
  admin_name: 'Joao Paulo',
  owner_profile: {
    kind: 'professional' as const,
    name: 'Joao Paulo',
    email: 'joao@synes.tech',
    specialty: 'Psicologo',
    crp: 'CRP 01',
    foto_url: 'clinic/user/avatar.png',
  },
  clinic: {
    name: 'Consultório Joao Paulo',
    email: 'joao@synes.tech',
    phone: '(11) 99995-9108',
    document: '',
  },
  preferences: {
    crisis_alerts_email: false,
    weekly_digest_email: true,
    ai_usage_alerts: true,
  },
};

describe('unwrapClinicSettings', () => {
  it('aceita payload direto', () => {
    expect(unwrapClinicSettings(payload)?.clinic?.name).toBe('Consultório Joao Paulo');
  });

  it('aceita payload envelopado em data', () => {
    expect(unwrapClinicSettings({ success: true, data: payload })?.owner_profile?.name).toBe(
      'Joao Paulo',
    );
  });
});

describe('clinicSettingsToFormState', () => {
  it('hidrata inputs a partir do GET', () => {
    const form = clinicSettingsToFormState(payload);
    expect(form?.profile.name).toBe('Consultório Joao Paulo');
    expect(form?.ownerProfile.specialty).toBe('Psicologo');
    expect(form?.ownerProfile.foto_url).toBe('clinic/user/avatar.png');
    expect(form?.prefs.crisis_alerts_email).toBe(false);
  });

  it('não quebra se clinic vier ausente', () => {
    const form = clinicSettingsToFormState({ owner_profile: { name: 'Ana' } });
    expect(form?.profile.name).toBe('');
    expect(form?.ownerProfile.name).toBe('Ana');
  });

  it('hidrata o snapshot devolvido pelo update', () => {
    const form = clinicSettingsToFormState({
      updated: true,
      clinic: { name: 'Consultório Novo', email: 'a@b.com', phone: '11', document: '' },
      owner_profile: { name: 'Ana', specialty: 'TO', crp: '', kind: 'professional' },
      preferences: { crisis_alerts_email: true, weekly_digest_email: false, ai_usage_alerts: true },
    });
    expect(form?.profile.name).toBe('Consultório Novo');
    expect(form?.ownerProfile.specialty).toBe('TO');
    expect(form?.prefs.weekly_digest_email).toBe(false);
  });
});

describe('isSettingsFormDirty', () => {
  it('retorna false quando o formulário é igual ao snapshot', () => {
    const form = clinicSettingsToFormState(payload);
    expect(form).not.toBeNull();
    expect(isSettingsFormDirty(form!, form)).toBe(false);
  });

  it('detecta mudança em preferência e no nome do consultório', () => {
    const form = clinicSettingsToFormState(payload)!;
    expect(
      isSettingsFormDirty(
        { ...form, prefs: { ...form.prefs, weekly_digest_email: false } },
        form,
      ),
    ).toBe(true);
    expect(
      isSettingsFormDirty(
        { ...form, profile: { ...form.profile, name: 'Outro consultório' } },
        form,
      ),
    ).toBe(true);
  });
});

describe('patientUsagePercent', () => {
  it('retorna null sem limite e limita em 100', () => {
    expect(patientUsagePercent(8, null)).toBeNull();
    expect(patientUsagePercent(8, 0)).toBeNull();
    expect(patientUsagePercent(3, 10)).toBe(30);
    expect(patientUsagePercent(12, 10)).toBe(100);
  });
});
