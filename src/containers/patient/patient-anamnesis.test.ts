/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { EMPTY_ANAMNESIS_FORM, normalizeLegacyPatientPartial } from './patient-anamnesis.types';
import { canAdvanceFromStep, validateAnamnesisStep } from './patient-anamnesis.validation';

describe('patient anamnesis — retrocompatibilidade', () => {
  it('normaliza paciente legado sem campos de anamnese', () => {
    const legacy = {
      id: 'uuid',
      name: 'João',
      birth_date: '2015-01-01',
      diagnoses: ['TEA'],
      clinical_observations: null,
    };
    const normalized = normalizeLegacyPatientPartial(legacy);
    expect(normalized.nome_social).toBeNull();
    expect(normalized.queixa_principal).toBeNull();
    expect(normalized.acompanhamento_multi).toEqual([]);
    expect(normalized.informacoes_adicionais).toBeNull();
    expect(legacy.name).toBe('João');
    expect(normalized.queixa_principal).toBeNull();
  });

  it('não quebra com objeto mínimo antigo', () => {
    expect(() => normalizeLegacyPatientPartial({ name: 'Maria' })).not.toThrow();
  });
});

describe('patient anamnesis wizard — validação de etapas', () => {
  it('impede avançar do passo 1 sem campos obrigatórios', () => {
    expect(canAdvanceFromStep(1, EMPTY_ANAMNESIS_FORM)).toBe(false);
    const partial = { ...EMPTY_ANAMNESIS_FORM, name: 'Ana', birth_date: '2018-05-10' };
    expect(canAdvanceFromStep(1, partial)).toBe(false);
  });

  it('permite avançar do passo 1 com nome, nascimento e diagnóstico', () => {
    const valid = {
      ...EMPTY_ANAMNESIS_FORM,
      name: 'Pedro Silva',
      birth_date: '2016-03-20',
      diagnoses: 'TEA, TDAH',
    };
    expect(canAdvanceFromStep(1, valid)).toBe(true);
    expect(validateAnamnesisStep(1, valid).valid).toBe(true);
  });

  it('passos 2–4 são opcionais (sempre podem avançar)', () => {
    expect(canAdvanceFromStep(2, EMPTY_ANAMNESIS_FORM)).toBe(true);
    expect(canAdvanceFromStep(3, EMPTY_ANAMNESIS_FORM)).toBe(true);
    expect(canAdvanceFromStep(4, EMPTY_ANAMNESIS_FORM)).toBe(true);
  });
});
