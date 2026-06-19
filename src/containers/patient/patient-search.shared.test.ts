/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  buildPatientSearchOrFilter,
  matchFieldForPatient,
  normalizePatientSearchTerm,
} from '../../../supabase/functions/_shared/patient-search.ts';

describe('patient-search shared', () => {
  it('detecta termo CPF com 11 dígitos', () => {
    const result = normalizePatientSearchTerm('529.982.247-25');
    expect(result.isCpf).toBe(true);
    expect(result.cpfDigits).toBe('52998224725');
  });

  it('monta filtro OR para CPF paciente e responsável', () => {
    const { term, isCpf, cpfDigits } = normalizePatientSearchTerm('11144477735');
    expect(buildPatientSearchOrFilter(term, isCpf, cpfDigits)).toBe(
      'cpf_paciente.eq.11144477735,cpf_responsavel.eq.11144477735',
    );
  });

  it('monta filtro ILIKE para nome', () => {
    const { term, isCpf, cpfDigits } = normalizePatientSearchTerm('Ana');
    expect(isCpf).toBe(false);
    expect(buildPatientSearchOrFilter(term, isCpf, cpfDigits)).toBe('name.ilike.%Ana%');
  });

  it('identifica campo de match do CPF', () => {
    expect(
      matchFieldForPatient('11144477735', {
        cpf_paciente: '11144477735',
        cpf_responsavel: '52998224725',
      }),
    ).toBe('cpf_paciente');
    expect(
      matchFieldForPatient('52998224725', {
        cpf_paciente: null,
        cpf_responsavel: '52998224725',
      }),
    ).toBe('cpf_responsavel');
  });
});
