import type { FinanceBillingType, FinanceModelType } from '@containers/financeiro/financeiro.types';
import { deriveProfileType, type PatientProfileType } from '@shared/lib/clinical-profile';

export type PatientContactScope = 'patient' | 'responsible' | 'both';

/** Condição escolhida na taxonomia clínica curada. */
export interface SelectedCondition {
  id: string;
  label: string;
}

export interface PatientAnamnesisForm {
  name: string;
  nome_social: string;
  birth_date: string;
  escolaridade_ocupacao: string;
  /** Texto livre — mantido para condições que ainda não estão no catálogo. */
  diagnoses: string;
  /** Condições da taxonomia curada. Alimentam o RAG com vocabulário normalizado. */
  conditions: SelectedCondition[];
  /** Rede de apoio do adulto — o equivalente honesto à composição familiar da criança. */
  support_network: string;
  occupation_routine: string;
  mapped_triggers: string;
  /** O terapeuta pode cadastrar agora e convidar depois. */
  portal_invite_send: boolean;
  queixa_principal: string;
  medicamentos: string;
  acompanhamento_multi: string[];
  clinical_observations: string;
  composicao_familiar: string;
  responsaveis: string;
  objetivos_terapeuticos: string;
  hiperfocos_interesses: string;
  informacoes_adicionais: string;
  contact_scope: PatientContactScope | '';
  email_paciente: string;
  telefone_paciente: string;
  email_responsavel: string;
  telefone_responsavel: string;
  financeiro_modelo: 'avulso' | 'pacote' | 'social' | '';
  financeiro_model_type: FinanceModelType | '';
  financeiro_billing_type: FinanceBillingType | '';
  financeiro_valor_sessao: string;
  financeiro_due_day: string;
  financeiro_sessions_per_month: string;
  financeiro_sessions_custom: boolean;
  financeiro_duration_months: string;
  financeiro_pacote_qtd: string;
  financeiro_pacote_valor: string;
  financeiro_registrar_pacote_pago: boolean;
  financeiro_observacoes: string;
}

export const EMPTY_ANAMNESIS_FORM: PatientAnamnesisForm = {
  name: '',
  nome_social: '',
  birth_date: '',
  escolaridade_ocupacao: '',
  diagnoses: '',
  conditions: [],
  support_network: '',
  occupation_routine: '',
  mapped_triggers: '',
  portal_invite_send: true,
  queixa_principal: '',
  medicamentos: '',
  acompanhamento_multi: [],
  clinical_observations: '',
  composicao_familiar: '',
  responsaveis: '',
  objetivos_terapeuticos: '',
  hiperfocos_interesses: '',
  informacoes_adicionais: '',
  contact_scope: '',
  email_paciente: '',
  telefone_paciente: '',
  email_responsavel: '',
  telefone_responsavel: '',
  financeiro_modelo: '',
  financeiro_model_type: '',
  financeiro_billing_type: '',
  financeiro_valor_sessao: '150,00',
  financeiro_due_day: '10',
  financeiro_sessions_per_month: '4',
  financeiro_sessions_custom: false,
  financeiro_duration_months: '',
  financeiro_pacote_qtd: '4',
  financeiro_pacote_valor: '600,00',
  financeiro_registrar_pacote_pago: false,
  financeiro_observacoes: '',
};

export const TOTAL_WIZARD_STEPS = 6;

/**
 * O perfil do paciente não é uma opinião do terapeuta: é a idade dele. Derivar da data de
 * nascimento em vez de perguntar elimina uma classe inteira de erro de cadastro — e o
 * backend rejeita perfil que não confere com a data, então um seletor livre só produziria
 * erro de validação depois de seis passos preenchidos.
 */
export function profileFromForm(form: Pick<PatientAnamnesisForm, 'birth_date'>): PatientProfileType | null {
  return form.birth_date ? deriveProfileType(form.birth_date) : null;
}

/**
 * O rótulo do passo 3 muda com o perfil porque o conteúdo muda: para uma criança
 * perguntamos quem cuida dela; para um adulto, com quem ele conta.
 */
export function wizardStepsForProfile(
  profile: PatientProfileType | null,
): { id: number; label: string }[] {
  return [
    { id: 1, label: 'Dados Básicos' },
    { id: 2, label: 'Contexto Clínico' },
    { id: 3, label: profile === 'ADULT' ? 'Rede de Apoio' : 'Dinâmica Familiar' },
    { id: 4, label: 'Parametrização IA' },
    { id: 5, label: 'Portal e Contato' },
    { id: 6, label: 'Financeiro' },
  ];
}

export const WIZARD_STEPS = wizardStepsForProfile(null);

export interface PortalScopeOption {
  value: PatientContactScope;
  label: string;
  hint: string;
}

/**
 * Quem recebe o convite do portal.
 *
 * Menor de idade nunca aparece sozinho: o portal de uma criança é do responsável, e o
 * acesso autônomo de adolescente depende de consentimento registrado — não é uma escolha
 * de cadastro. Já o adulto pode ter alguém acompanhando por ele (curatela, TEA adulto,
 * quadro grave), e nesse caso o convite vai para o cuidador.
 */
export function portalScopeOptionsForProfile(profile: PatientProfileType | null): PortalScopeOption[] {
  if (profile === 'ADULT') {
    return [
      {
        value: 'patient',
        label: 'O próprio paciente',
        hint: 'Recebe o convite e acompanha o próprio processo',
      },
      {
        value: 'responsible',
        label: 'Uma pessoa de apoio',
        hint: 'Cuidador ou familiar acompanha em nome do paciente',
      },
      {
        value: 'both',
        label: 'Ambos',
        hint: 'Paciente com acesso próprio e uma pessoa de apoio',
      },
    ];
  }

  return [
    {
      value: 'responsible',
      label: 'Apenas o responsável',
      hint: 'Pai, mãe ou cuidador recebe o convite do portal',
    },
    {
      value: 'both',
      label: 'Responsável e paciente',
      hint: 'O portal fica com o responsável; o paciente recebe os lembretes',
    },
  ];
}

/** Compat: consumidores antigos que listavam os três escopos sem contexto de perfil. */
export const CONTACT_SCOPE_OPTIONS: PortalScopeOption[] = [
  { value: 'responsible', label: 'Somente responsável', hint: 'E-mail e telefone do responsável' },
  { value: 'patient', label: 'Somente paciente', hint: 'E-mail e telefone do paciente' },
  { value: 'both', label: 'Ambos', hint: 'Contatos do paciente e do responsável' },
];

export const ACOMPANHAMENTO_OPTIONS = [
  'Psicologia',
  'Fonoaudiologia',
  'Terapia Ocupacional',
  'Psicopedagogia',
  'Neurologia',
  'Psiquiatria',
  'Nutrição',
  'Fisioterapia',
] as const;

export function parseDiagnoses(raw: string): string[] {
  return raw.split(',').map((d) => d.trim()).filter(Boolean);
}

function anamnesisFieldsFromForm(form: PatientAnamnesisForm) {
  return {
    name: form.name.trim(),
    birth_date: form.birth_date,
    diagnoses: parseDiagnoses(form.diagnoses),
    nome_social: form.nome_social.trim() || undefined,
    escolaridade_ocupacao: form.escolaridade_ocupacao.trim() || undefined,
    queixa_principal: form.queixa_principal.trim() || undefined,
    medicamentos: form.medicamentos.trim() || undefined,
    acompanhamento_multi: form.acompanhamento_multi,
    clinical_observations: form.clinical_observations.trim() || undefined,
    composicao_familiar: form.composicao_familiar.trim() || undefined,
    responsaveis: form.responsaveis.trim() || undefined,
    objetivos_terapeuticos: form.objetivos_terapeuticos.trim() || undefined,
    hiperfocos_interesses: form.hiperfocos_interesses.trim() || undefined,
    informacoes_adicionais: form.informacoes_adicionais.trim() || undefined,
  };
}

export function formToUpdatePayload(patientId: string, form: PatientAnamnesisForm) {
  return {
    patient_id: patientId,
    ...anamnesisFieldsFromForm(form),
  };
}

type PatientInfoLike = {
  name: string;
  birth_date: string;
  diagnoses: string[];
  nome_social?: string | null;
  escolaridade_ocupacao?: string | null;
  queixa_principal?: string | null;
  medicamentos?: string | null;
  acompanhamento_multi?: string[] | null;
  clinical_observations?: string | null;
  composicao_familiar?: string | null;
  responsaveis?: string | null;
  objetivos_terapeuticos?: string | null;
  hiperfocos_interesses?: string | null;
  informacoes_adicionais?: string | null;
  support_network?: string | null;
  occupation_routine?: string | null;
  mapped_triggers?: string | null;
};

export function patientInfoToForm(p: PatientInfoLike): PatientAnamnesisForm {
  return {
    name: p.name,
    nome_social: p.nome_social ?? '',
    birth_date: p.birth_date,
    escolaridade_ocupacao: p.escolaridade_ocupacao ?? '',
    diagnoses: (p.diagnoses ?? []).join(', '),
    conditions: [],
    support_network: p.support_network ?? '',
    occupation_routine: p.occupation_routine ?? '',
    mapped_triggers: p.mapped_triggers ?? '',
    portal_invite_send: true,
    queixa_principal: p.queixa_principal ?? '',
    medicamentos: p.medicamentos ?? '',
    acompanhamento_multi: p.acompanhamento_multi ?? [],
    clinical_observations: p.clinical_observations ?? '',
    composicao_familiar: p.composicao_familiar ?? '',
    responsaveis: p.responsaveis ?? '',
    objetivos_terapeuticos: p.objetivos_terapeuticos ?? '',
    hiperfocos_interesses: p.hiperfocos_interesses ?? '',
    informacoes_adicionais: p.informacoes_adicionais ?? '',
    contact_scope: '',
    email_paciente: '',
    telefone_paciente: '',
    email_responsavel: '',
    telefone_responsavel: '',
    financeiro_modelo: '',
    financeiro_model_type: '',
    financeiro_billing_type: '',
    financeiro_valor_sessao: '150,00',
    financeiro_due_day: '10',
    financeiro_sessions_per_month: '4',
    financeiro_sessions_custom: false,
    financeiro_duration_months: '',
    financeiro_pacote_qtd: '4',
    financeiro_pacote_valor: '600,00',
    financeiro_registrar_pacote_pago: false,
    financeiro_observacoes: '',
  };
}

export function isClinicalFormDirty(a: PatientAnamnesisForm, b: PatientAnamnesisForm): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

/** Payload PATCH com apenas campos alterados. */
export function formToPartialUpdatePayload(
  patientId: string,
  current: PatientAnamnesisForm,
  saved: PatientAnamnesisForm,
) {
  const full = formToUpdatePayload(patientId, current);
  const baseline = formToUpdatePayload(patientId, saved);
  const patch: Record<string, unknown> = { patient_id: patientId };
  for (const [key, value] of Object.entries(full)) {
    if (key === 'patient_id') continue;
    if (JSON.stringify(value) !== JSON.stringify((baseline as Record<string, unknown>)[key])) {
      patch[key] = value;
    }
  }
  return patch;
}

/** Paciente legado sem anamnese — campos ausentes ou nulos (testes e UI). */
export function normalizeLegacyPatientPartial(patient: Record<string, unknown>) {
  return {
    ...patient,
    nome_social: (patient.nome_social as string | null | undefined) ?? null,
    escolaridade_ocupacao: (patient.escolaridade_ocupacao as string | null | undefined) ?? null,
    queixa_principal: (patient.queixa_principal as string | null | undefined) ?? null,
    medicamentos: (patient.medicamentos as string | null | undefined) ?? null,
    acompanhamento_multi: Array.isArray(patient.acompanhamento_multi)
      ? (patient.acompanhamento_multi as string[])
      : [],
    composicao_familiar: (patient.composicao_familiar as string | null | undefined) ?? null,
    responsaveis: (patient.responsaveis as string | null | undefined) ?? null,
    objetivos_terapeuticos: (patient.objetivos_terapeuticos as string | null | undefined) ?? null,
    hiperfocos_interesses: (patient.hiperfocos_interesses as string | null | undefined) ?? null,
    informacoes_adicionais: (patient.informacoes_adicionais as string | null | undefined) ?? null,
  };
}
