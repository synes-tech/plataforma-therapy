/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  EMPTY_ANAMNESIS_FORM,
  isClinicalFormDirty,
  patientInfoToForm,
  formToPartialUpdatePayload,
} from './patient-anamnesis.types';

describe('ficha clínica — estado e PATCH', () => {
  const saved = {
    ...EMPTY_ANAMNESIS_FORM,
    name: 'Ana Costa',
    birth_date: '2015-06-01',
    diagnoses: 'TEA',
    medicamentos: 'Ritalina 10mg',
  };

  it('mantém alterações não salvas ao simular troca de aba (estado no pai)', () => {
    const edited = { ...saved, medicamentos: 'Ritalina 20mg' };
    expect(isClinicalFormDirty(edited, saved)).toBe(true);
    // Estado `edited` permanece no componente pai entre abas
    expect(edited.medicamentos).toBe('Ritalina 20mg');
  });

  it('gera PATCH apenas com campo alterado', () => {
    const edited = { ...saved, medicamentos: 'Novo medicamento' };
    const patch = formToPartialUpdatePayload('patient-uuid', edited, saved);
    expect(patch.patient_id).toBe('patient-uuid');
    expect(patch.medicamentos).toBe('Novo medicamento');
    expect(patch.name).toBeUndefined();
    expect(patch.queixa_principal).toBeUndefined();
  });

  it('gera PATCH com todos os campos quando tudo mudou', () => {
    const edited = {
      ...saved,
      name: 'Ana Silva',
      diagnoses: 'TEA, TDAH',
      queixa_principal: 'Hiperatividade',
      hiperfocos_interesses: 'Dinossauros',
    };
    const patch = formToPartialUpdatePayload('id-1', edited, saved);
    expect(patch.name).toBe('Ana Silva');
    expect(patch.diagnoses).toEqual(['TEA', 'TDAH']);
    expect(patch.queixa_principal).toBe('Hiperatividade');
    expect(patch.hiperfocos_interesses).toBe('Dinossauros');
  });

  it('converte paciente legado (campos nulos) para formulário editável', () => {
    const form = patientInfoToForm({
      name: 'Legado',
      birth_date: '2010-01-01',
      diagnoses: ['TDAH'],
      queixa_principal: null,
      medicamentos: null,
    });
    expect(form.queixa_principal).toBe('');
    expect(form.medicamentos).toBe('');
    expect(isClinicalFormDirty(form, form)).toBe(false);
  });
});
