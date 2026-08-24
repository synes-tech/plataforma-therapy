import { describe, expect, it } from 'vitest';

import {
  BASE_MODULE,
  calculateAge,
  canGrantSelfAccess,
  canSubscribePremium,
  defaultAutonomyForProfile,
  defaultPortalAccessLevel,
  deriveProfileType,
  hasModule,
  isMinor,
  normalizeModules,
} from './clinical-profile';

const HOJE = new Date('2026-08-22T12:00:00');

describe('calculateAge', () => {
  it('não conta o ano quando o aniversário ainda não chegou', () => {
    expect(calculateAge('2000-12-31', HOJE)).toBe(25);
  });

  it('conta o ano no próprio dia do aniversário', () => {
    expect(calculateAge('2000-08-22', HOJE)).toBe(26);
  });

  it('devolve NaN para data inválida em vez de um número enganoso', () => {
    expect(Number.isNaN(calculateAge('data-invalida', HOJE))).toBe(true);
  });
});

describe('deriveProfileType', () => {
  it('classifica criança abaixo de 13 anos', () => {
    expect(deriveProfileType('2020-01-10', HOJE)).toBe('CHILD');
  });

  it('vira adolescente exatamente no 13º aniversário', () => {
    expect(deriveProfileType('2013-08-22', HOJE)).toBe('ADOLESCENT');
    expect(deriveProfileType('2013-08-23', HOJE)).toBe('CHILD');
  });

  it('vira adulto exatamente no 18º aniversário', () => {
    expect(deriveProfileType('2008-08-22', HOJE)).toBe('ADULT');
    expect(deriveProfileType('2008-08-23', HOJE)).toBe('ADOLESCENT');
  });

  it('trata data ausente como adulto, e não como criança', () => {
    expect(deriveProfileType(null, HOJE)).toBe('ADULT');
    expect(deriveProfileType(undefined, HOJE)).toBe('ADULT');
  });

  it('aceita timestamp completo vindo do banco', () => {
    expect(deriveProfileType('1990-03-15T00:00:00.000Z', HOJE)).toBe('ADULT');
  });
});

describe('padrões derivados do perfil', () => {
  it('associa autonomia coerente com a faixa', () => {
    expect(defaultAutonomyForProfile('CHILD')).toBe('DEPENDENT');
    expect(defaultAutonomyForProfile('ADOLESCENT')).toBe('SUPPORTED');
    expect(defaultAutonomyForProfile('ADULT')).toBe('SELF_MANAGED');
  });

  it('só dá acesso SELF por padrão para adulto', () => {
    expect(defaultPortalAccessLevel('CHILD')).toBe('CAREGIVER');
    expect(defaultPortalAccessLevel('ADOLESCENT')).toBe('CAREGIVER');
    expect(defaultPortalAccessLevel('ADULT')).toBe('SELF');
  });
});

describe('normalizeModules', () => {
  it('sempre inclui o módulo base', () => {
    expect(normalizeModules([])).toEqual([BASE_MODULE]);
    expect(normalizeModules(null)).toEqual([BASE_MODULE]);
    expect(normalizeModules(['NEURODESENVOLVIMENTO'])).toEqual([BASE_MODULE, 'NEURODESENVOLVIMENTO']);
  });

  it('remove duplicatas e mantém ordem estável', () => {
    expect(normalizeModules(['NEURODESENVOLVIMENTO', 'CLINICO_GERAL', 'NEURODESENVOLVIMENTO']))
      .toEqual(['CLINICO_GERAL', 'NEURODESENVOLVIMENTO']);
  });

  it('hasModule reconhece o módulo especializado', () => {
    expect(hasModule(['CLINICO_GERAL', 'NEURODESENVOLVIMENTO'], 'NEURODESENVOLVIMENTO')).toBe(true);
    expect(hasModule(['CLINICO_GERAL'], 'NEURODESENVOLVIMENTO')).toBe(false);
    expect(hasModule(null, 'CLINICO_GERAL')).toBe(false);
  });
});

describe('regras de menoridade e premium', () => {
  it('identifica menor de idade', () => {
    expect(isMinor('2010-01-01', HOJE)).toBe(true);
    expect(isMinor('2000-01-01', HOJE)).toBe(false);
  });

  it('libera premium apenas a partir dos 18 anos completos', () => {
    expect(canSubscribePremium('2008-08-22', HOJE)).toBe(true);
    expect(canSubscribePremium('2008-08-23', HOJE)).toBe(false);
  });

  it('nega premium quando a data de nascimento é desconhecida', () => {
    expect(canSubscribePremium(null, HOJE)).toBe(false);
  });
});

describe('canGrantSelfAccess', () => {
  it('adulto não depende de consentimento de terceiro', () => {
    expect(canGrantSelfAccess('ADULT', false)).toBe(true);
  });

  it('adolescente só com consentimento do responsável', () => {
    expect(canGrantSelfAccess('ADOLESCENT', false)).toBe(false);
    expect(canGrantSelfAccess('ADOLESCENT', true)).toBe(true);
  });

  it('criança nunca recebe acesso SELF, mesmo com consentimento', () => {
    expect(canGrantSelfAccess('CHILD', true)).toBe(false);
  });
});
