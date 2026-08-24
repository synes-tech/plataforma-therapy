/**
 * Regras do wizard condicional de cadastro.
 *
 * O que estes testes protegem, no fundo, é uma única promessa: o formulário de uma criança e
 * o de um adulto não são o mesmo formulário. Se alguém reintroduzir "dinâmica familiar" para
 * adulto ou deixar um menor receber acesso próprio ao portal, isto quebra.
 */
import { describe, expect, it } from 'vitest';

import {
  EMPTY_ANAMNESIS_FORM,
  portalScopeOptionsForProfile,
  profileFromForm,
  wizardStepsForProfile,
  type PatientAnamnesisForm,
} from './patient-anamnesis.types';
import { validateAnamnesisStep } from './patient-anamnesis.validation';
import { formToCreatePayload } from './patient-create-payload';
import { patientCreatedMessage } from './patient-created-message';
import {
  displayLabel,
  filterTaxonomy,
  groupByCategory,
  normalizeSearch,
  type ClinicalTaxonomyEntry,
} from './clinical-taxonomy';

const IDENTITY = {
  mode: 'own_cpf' as const,
  cpfPaciente: '12345678909',
  cpfResponsavel: '',
  nomeResponsavel: '',
};

/** Data de nascimento que resulta na idade pedida, relativa a hoje. */
function birthDateForAge(age: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function form(overrides: Partial<PatientAnamnesisForm> = {}): PatientAnamnesisForm {
  return {
    ...EMPTY_ANAMNESIS_FORM,
    name: 'Paciente Teste',
    birth_date: birthDateForAge(30),
    diagnoses: 'Ansiedade',
    financeiro_model_type: 'PARTICULAR',
    financeiro_billing_type: 'AVULSO',
    ...overrides,
  };
}

describe('perfil derivado da data de nascimento', () => {
  it('classifica pelas fronteiras de 13 e 18 anos', () => {
    expect(profileFromForm({ birth_date: birthDateForAge(7) })).toBe('CHILD');
    expect(profileFromForm({ birth_date: birthDateForAge(12) })).toBe('CHILD');
    expect(profileFromForm({ birth_date: birthDateForAge(13) })).toBe('ADOLESCENT');
    expect(profileFromForm({ birth_date: birthDateForAge(17) })).toBe('ADOLESCENT');
    expect(profileFromForm({ birth_date: birthDateForAge(18) })).toBe('ADULT');
  });

  it('não assume perfil enquanto a data não foi preenchida', () => {
    expect(profileFromForm({ birth_date: '' })).toBeNull();
  });
});

describe('rótulos dos passos', () => {
  it('o passo 3 muda de nome conforme o perfil', () => {
    expect(wizardStepsForProfile('ADULT')[2]?.label).toBe('Rede de Apoio');
    expect(wizardStepsForProfile('CHILD')[2]?.label).toBe('Dinâmica Familiar');
    expect(wizardStepsForProfile('ADOLESCENT')[2]?.label).toBe('Dinâmica Familiar');
  });

  it('mantém seis passos em qualquer perfil, para o rodapé não descompassar', () => {
    for (const profile of ['CHILD', 'ADOLESCENT', 'ADULT', null] as const) {
      expect(wizardStepsForProfile(profile)).toHaveLength(6);
    }
  });
});

describe('opções de acesso ao portal', () => {
  it('adulto pode escolher acesso próprio, pessoa de apoio ou ambos', () => {
    expect(portalScopeOptionsForProfile('ADULT').map((o) => o.value)).toEqual([
      'patient',
      'responsible',
      'both',
    ]);
  });

  it('menor de idade nunca aparece com acesso próprio isolado', () => {
    for (const profile of ['CHILD', 'ADOLESCENT'] as const) {
      const values = portalScopeOptionsForProfile(profile).map((o) => o.value);
      expect(values).not.toContain('patient');
      expect(values).toEqual(['responsible', 'both']);
    }
  });
});

describe('validação condicional por passo', () => {
  it('exige condição do catálogo ou texto livre', () => {
    const semNada = validateAnamnesisStep(1, form({ diagnoses: '', conditions: [] }));
    expect(semNada.valid).toBe(false);
    expect(semNada.errors.conditions).toBeTruthy();

    const soCatalogo = validateAnamnesisStep(
      1,
      form({ diagnoses: '', conditions: [{ id: 'uuid-1', label: 'TEA' }] }),
    );
    expect(soCatalogo.valid).toBe(true);

    const soTexto = validateAnamnesisStep(1, form({ diagnoses: 'Hipótese de TEA' }));
    expect(soTexto.valid).toBe(true);
  });

  it('menor exige composição familiar e responsáveis no passo 3', () => {
    const result = validateAnamnesisStep(3, form({ birth_date: birthDateForAge(8) }));
    expect(result.valid).toBe(false);
    expect(result.errors.composicao_familiar).toBeTruthy();
    expect(result.errors.responsaveis).toBeTruthy();
  });

  it('adulto passa o passo 3 sem dinâmica familiar', () => {
    const result = validateAnamnesisStep(3, form({ birth_date: birthDateForAge(30) }));
    expect(result.valid).toBe(true);
  });

  it('adolescente também exige responsável', () => {
    const result = validateAnamnesisStep(3, form({ birth_date: birthDateForAge(15) }));
    expect(result.valid).toBe(false);
    expect(result.errors.responsaveis).toBeTruthy();
  });

  it('passo 5 exige o e-mail de quem vai receber o convite', () => {
    const semEscolha = validateAnamnesisStep(5, form({ contact_scope: '' }));
    expect(semEscolha.errors.contact_scope).toBeTruthy();

    const pacienteSemEmail = validateAnamnesisStep(5, form({ contact_scope: 'patient' }));
    expect(pacienteSemEmail.errors.email_paciente).toBeTruthy();

    const ok = validateAnamnesisStep(
      5,
      form({ contact_scope: 'patient', email_paciente: 'ana@exemplo.com' }),
    );
    expect(ok.valid).toBe(true);
  });

  it('escopo "ambos" cobra os dois e-mails', () => {
    const result = validateAnamnesisStep(
      5,
      form({ contact_scope: 'both', email_paciente: 'ana@exemplo.com' }),
    );
    expect(result.errors.email_responsavel).toBeTruthy();
  });
});

describe('payload de criação', () => {
  it('envia o perfil derivado e o módulo base', () => {
    const payload = formToCreatePayload(form({ birth_date: birthDateForAge(30) }), IDENTITY);
    expect(payload.profile_type).toBe('ADULT');
    expect(payload.active_modules).toEqual(['CLINICO_GERAL']);
  });

  it('envia os ids da taxonomia junto com o texto livre', () => {
    const payload = formToCreatePayload(
      form({ conditions: [{ id: 'uuid-1', label: 'TEA' }], diagnoses: 'Hipótese de TDAH' }),
      IDENTITY,
    );
    expect(payload.condition_ids).toEqual(['uuid-1']);
    expect(payload.diagnoses).toEqual(['Hipótese de TDAH']);
  });

  it('omite condition_ids quando nada foi escolhido no catálogo', () => {
    const payload = formToCreatePayload(form({ conditions: [] }), IDENTITY);
    expect(payload.condition_ids).toBeUndefined();
  });

  it('adulto envia rede de apoio e não envia dinâmica familiar', () => {
    const payload = formToCreatePayload(
      form({
        birth_date: birthDateForAge(30),
        support_network: 'Parceira e dois amigos',
        occupation_routine: 'Trabalha remoto, dorme mal',
        composicao_familiar: 'resíduo de um perfil anterior',
        responsaveis: 'resíduo',
        hiperfocos_interesses: 'resíduo',
      }),
      IDENTITY,
    );

    expect(payload.support_network).toBe('Parceira e dois amigos');
    expect(payload.occupation_routine).toBe('Trabalha remoto, dorme mal');
    expect(payload.composicao_familiar).toBeUndefined();
    expect(payload.responsaveis).toBeUndefined();
    expect(payload.hiperfocos_interesses).toBeUndefined();
  });

  it('criança envia dinâmica familiar e hiperfocos, mas não rede de apoio nem gatilhos', () => {
    const payload = formToCreatePayload(
      form({
        birth_date: birthDateForAge(8),
        composicao_familiar: 'Mora com a mãe',
        responsaveis: 'Mãe',
        hiperfocos_interesses: 'Dinossauros',
        support_network: 'resíduo',
        mapped_triggers: 'resíduo',
      }),
      IDENTITY,
    );

    expect(payload.composicao_familiar).toBe('Mora com a mãe');
    expect(payload.hiperfocos_interesses).toBe('Dinossauros');
    expect(payload.support_network).toBeUndefined();
    expect(payload.mapped_triggers).toBeUndefined();
  });

  it('adolescente registra gatilhos, que fazem sentido a partir dessa idade', () => {
    const payload = formToCreatePayload(
      form({ birth_date: birthDateForAge(15), mapped_triggers: 'Provas e conflitos em casa' }),
      IDENTITY,
    );
    expect(payload.mapped_triggers).toBe('Provas e conflitos em casa');
  });

  it('respeita a escolha de não enviar o convite agora', () => {
    expect(formToCreatePayload(form({ portal_invite_send: false }), IDENTITY).portal_invite)
      .toEqual({ send: false });
    expect(formToCreatePayload(form(), IDENTITY).portal_invite).toEqual({ send: true });
  });
});

describe('retorno ao terapeuta depois do cadastro', () => {
  const base = { patientId: 'p1', patientName: 'Ana' };

  it('diz para quem o convite foi enviado', () => {
    const result = patientCreatedMessage({
      ...base,
      portalInvite: { code: 'AB12CD34', recipient: 'caregiver', email: 'mae@exemplo.com', sent: true },
    });
    expect(result.variant).toBe('success');
    expect(result.message).toContain('para o responsável');
    expect(result.message).toContain('mae@exemplo.com');
  });

  it('distingue o convite que foi para o próprio paciente', () => {
    const result = patientCreatedMessage({
      ...base,
      portalInvite: { code: 'AB12CD34', recipient: 'patient', email: 'ana@exemplo.com', sent: true },
    });
    expect(result.message).toContain('para o paciente');
  });

  it('não deixa a falha de envio passar em silêncio, e entrega o código', () => {
    const result = patientCreatedMessage({
      ...base,
      portalInvite: { code: 'AB12CD34', recipient: 'patient', email: 'ana@exemplo.com', sent: false },
    });
    expect(result.variant).toBe('error');
    expect(result.message).toContain('AB12CD34');
  });

  it('cadastro sem convite tem mensagem simples', () => {
    const result = patientCreatedMessage({ ...base, portalInvite: null });
    expect(result.variant).toBe('success');
    expect(result.message).toBe('Ana foi cadastrado.');
  });
});

describe('busca na taxonomia clínica', () => {
  const entries: ClinicalTaxonomyEntry[] = [
    {
      id: '1',
      code: 'TEA',
      label: 'Transtorno do Espectro Autista',
      short_label: 'TEA',
      category: 'NEURODESENVOLVIMENTO',
      synonyms: ['autismo', 'espectro autista'],
      suggested_modules: ['NEURODESENVOLVIMENTO'],
      sort_order: 1,
    },
    {
      id: '2',
      code: 'TAG',
      label: 'Transtorno de Ansiedade Generalizada',
      short_label: 'Ansiedade generalizada',
      category: 'ANSIEDADE',
      synonyms: ['ansiedade'],
      suggested_modules: null,
      sort_order: 2,
    },
    {
      id: '3',
      code: 'BURNOUT',
      label: 'Esgotamento profissional',
      short_label: null,
      category: 'VIDA',
      synonyms: ['burnout'],
      suggested_modules: null,
      sort_order: 3,
    },
  ];

  it('ignora acento e caixa', () => {
    expect(normalizeSearch('Ansiedade Generalizada')).toBe('ansiedade generalizada');
    expect(normalizeSearch('  TEA  ')).toBe('tea');
  });

  it('encontra pelo termo que o terapeuta usa, não só pelo nome oficial', () => {
    expect(filterTaxonomy(entries, 'autismo').map((e) => e.code)).toEqual(['TEA']);
    expect(filterTaxonomy(entries, 'burnout').map((e) => e.code)).toEqual(['BURNOUT']);
    expect(filterTaxonomy(entries, 'ansiedade').map((e) => e.code)).toEqual(['TAG']);
  });

  it('não sugere o que já foi selecionado', () => {
    expect(filterTaxonomy(entries, '', ['1', '2']).map((e) => e.code)).toEqual(['BURNOUT']);
  });

  it('devolve tudo quando a busca está vazia', () => {
    expect(filterTaxonomy(entries, '')).toHaveLength(3);
  });

  it('usa o rótulo curto quando existe, e o nome clínico quando não existe', () => {
    expect(displayLabel(entries[0]!)).toBe('TEA');
    expect(displayLabel(entries[2]!)).toBe('Esgotamento profissional');
  });

  it('agrupa por categoria com rótulo em português', () => {
    const groups = groupByCategory(entries);
    expect(groups.map((g) => g.label)).toEqual([
      'Neurodesenvolvimento',
      'Ansiedade',
      'Questões de vida',
    ]);
  });
});
