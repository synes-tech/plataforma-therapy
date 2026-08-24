import { describe, expect, it } from 'vitest';
import { scriptForAudience, TOUR_SCRIPTS } from './thery-tour.scripts';

const KNOWN_PREFIXES = [
  '/dashboard',
  '/patients',
  '/calendar',
  '/financeiro',
  '/copilot',
  '/session',
  '/settings',
  '/professionals',
  '/portal/diary',
  '/portal/calendar',
  '/portal/ivy',
  '/portal/agreements',
  '/ajuda',
];

describe('roteiros da Ivy', () => {
  it('ids únicos em cada audiência', () => {
    for (const [audience, steps] of Object.entries(TOUR_SCRIPTS)) {
      const ids = steps.map((step) => step.id);
      expect(new Set(ids).size, audience).toBe(ids.length);
    }
  });

  it('rotas conhecidas ou template de paciente', () => {
    for (const steps of Object.values(TOUR_SCRIPTS)) {
      for (const step of steps) {
        const ok = KNOWN_PREFIXES.some(
          (prefix) => step.route === prefix || step.route.startsWith(`${prefix}/`) || step.route.startsWith(`${prefix}/:patientId`),
        );
        expect(ok, step.route).toBe(true);
      }
    }
  });

  it('profissional tem o caminho dourado e admin não tem agenda nem copiloto', () => {
    const pro = scriptForAudience('professional').map((step) => step.id);
    const admin = scriptForAudience('clinic_admin').map((step) => step.id);
    expect(pro).toContain('pro-new-patient');
    expect(pro).toContain('pro-finance');
    expect(pro).toContain('pro-copilot');
    expect(pro).toContain('pro-session');
    expect(admin).toContain('admin-team');
    expect(admin).not.toContain('pro-calendar');
    expect(admin).not.toContain('pro-copilot');
  });

  it('central do paciente cobre ficha, financeiro, documentos, convite e vínculo', () => {
    const pro = scriptForAudience('professional').map((step) => step.id);
    const admin = scriptForAudience('clinic_admin').map((step) => step.id);
    const hubScreens = [
      'pro-clinical',
      'pro-patient-finance',
      'pro-documents',
      'pro-family-invite',
      'pro-manage-link',
    ];
    for (const id of hubScreens) {
      expect(pro).toContain(id);
    }
    expect(pro.indexOf('pro-checkins')).toBeLessThan(pro.indexOf('pro-clinical'));
    expect(pro.indexOf('pro-manage-link')).toBeLessThan(pro.indexOf('pro-calendar'));
    expect(admin).toContain('admin-clinical');
    expect(admin).toContain('admin-patient-finance');
    expect(admin).toContain('admin-documents');
    expect(admin).toContain('admin-family-invite');
    expect(admin).toContain('admin-manage-link');
    expect(admin.indexOf('admin-patient-hub')).toBeLessThan(admin.indexOf('admin-clinical'));
    expect(admin.indexOf('admin-manage-link')).toBeLessThan(admin.indexOf('admin-team'));
  });

  it('paciente tem Ivy no centro; cuidador não', () => {
    expect(scriptForAudience('patient').some((step) => step.id === 'self-thery')).toBe(true);
    expect(scriptForAudience('caregiver').some((step) => step.route === '/portal/ivy')).toBe(false);
  });
});
