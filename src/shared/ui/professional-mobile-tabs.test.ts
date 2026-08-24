/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  PROFESSIONAL_MOBILE_TABS,
  isProfessionalMobileTabActive,
  shouldShowProfessionalMobileTabs,
} from './professional-mobile-tabs';

describe('PROFESSIONAL_MOBILE_TABS', () => {
  it('mantém os 5 itens na ordem do app', () => {
    expect(PROFESSIONAL_MOBILE_TABS.map((tab) => tab.id)).toEqual([
      'dashboard',
      'agenda',
      'copilot',
      'financeiro',
      'patients',
    ]);
    expect(PROFESSIONAL_MOBILE_TABS[2]?.featured).toBe(true);
  });
});

describe('isProfessionalMobileTabActive', () => {
  it('marca agenda em /calendar e /agenda', () => {
    expect(isProfessionalMobileTabActive('/calendar', '/calendar')).toBe(true);
    expect(isProfessionalMobileTabActive('/agenda', '/calendar')).toBe(true);
  });

  it('marca pacientes no prontuário e copiloto só no workspace', () => {
    expect(isProfessionalMobileTabActive('/patients/abc/copilot', '/patients')).toBe(true);
    expect(isProfessionalMobileTabActive('/patients/abc/copilot', '/copilot')).toBe(false);
    expect(isProfessionalMobileTabActive('/copilot/abc', '/copilot')).toBe(true);
  });
});

describe('shouldShowProfessionalMobileTabs', () => {
  it('aparece só para o profissional', () => {
    expect(shouldShowProfessionalMobileTabs('professional')).toBe(true);
    expect(shouldShowProfessionalMobileTabs('clinic_admin')).toBe(false);
    expect(shouldShowProfessionalMobileTabs('family')).toBe(false);
  });
});
