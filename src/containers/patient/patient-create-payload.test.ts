/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { EMPTY_ANAMNESIS_FORM } from './patient-anamnesis.types';
import { formToCreatePayload } from './patient-create-payload';
import type { PatientCreateIdentity } from './patient-cpf.types';

const validForm = {
  ...EMPTY_ANAMNESIS_FORM,
  name: 'João Silva',
  birth_date: '2018-05-10',
  diagnoses: 'TEA',
};

describe('formToCreatePayload — identidade de dependentes', () => {
  it('cenário com CPF próprio envia cpf_paciente', () => {
    const identity: PatientCreateIdentity = {
      mode: 'own_cpf',
      cpfPaciente: '52998224725',
      cpfResponsavel: '',
      nomeResponsavel: '',
    };
    const payload = formToCreatePayload(validForm, identity);
    expect(payload).toMatchObject({
      possui_cpf_proprio: true,
      cpf_paciente: '52998224725',
      name: 'João Silva',
    });
    expect(payload).not.toHaveProperty('cpf_responsavel');
    expect(payload).not.toHaveProperty('nome_responsavel');
  });

  it('cenário dependente envia cpf_responsavel e nome_responsavel sem cpf_paciente', () => {
    const identity: PatientCreateIdentity = {
      mode: 'dependent',
      cpfPaciente: '',
      cpfResponsavel: '11144477735',
      nomeResponsavel: 'Maria Oliveira',
    };
    const payload = formToCreatePayload(validForm, identity);
    expect(payload).toMatchObject({
      possui_cpf_proprio: false,
      cpf_responsavel: '11144477735',
      nome_responsavel: 'Maria Oliveira',
    });
    expect(payload).not.toHaveProperty('cpf_paciente');
  });

  it('alternar modo limpa campos do cenário anterior no estado do modal (contrato)', () => {
    const own: PatientCreateIdentity = {
      mode: 'own_cpf',
      cpfPaciente: '52998224725',
      cpfResponsavel: '',
      nomeResponsavel: '',
    };
    const dependent: PatientCreateIdentity = {
      mode: 'dependent',
      cpfPaciente: '',
      cpfResponsavel: '',
      nomeResponsavel: '',
    };
    const ownPayload = formToCreatePayload(validForm, own);
    const depPayload = formToCreatePayload(validForm, dependent);
    expect(ownPayload).toHaveProperty('cpf_paciente');
    expect(depPayload).not.toHaveProperty('cpf_paciente');
  });
});
