export interface PatientAnamnesisForm {
  name: string;
  nome_social: string;
  birth_date: string;
  escolaridade_ocupacao: string;
  diagnoses: string;
  queixa_principal: string;
  medicamentos: string;
  acompanhamento_multi: string[];
  clinical_observations: string;
  composicao_familiar: string;
  responsaveis: string;
  objetivos_terapeuticos: string;
  hiperfocos_interesses: string;
  informacoes_adicionais: string;
}

export const EMPTY_ANAMNESIS_FORM: PatientAnamnesisForm = {
  name: '',
  nome_social: '',
  birth_date: '',
  escolaridade_ocupacao: '',
  diagnoses: '',
  queixa_principal: '',
  medicamentos: '',
  acompanhamento_multi: [],
  clinical_observations: '',
  composicao_familiar: '',
  responsaveis: '',
  objetivos_terapeuticos: '',
  hiperfocos_interesses: '',
  informacoes_adicionais: '',
};

export const WIZARD_STEPS = [
  { id: 1, label: 'Dados Básicos' },
  { id: 2, label: 'Contexto Clínico' },
  { id: 3, label: 'Dinâmica Familiar' },
  { id: 4, label: 'Parametrização IA' },
] as const;

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
};

export function patientInfoToForm(p: PatientInfoLike): PatientAnamnesisForm {
  return {
    name: p.name,
    nome_social: p.nome_social ?? '',
    birth_date: p.birth_date,
    escolaridade_ocupacao: p.escolaridade_ocupacao ?? '',
    diagnoses: (p.diagnoses ?? []).join(', '),
    queixa_principal: p.queixa_principal ?? '',
    medicamentos: p.medicamentos ?? '',
    acompanhamento_multi: p.acompanhamento_multi ?? [],
    clinical_observations: p.clinical_observations ?? '',
    composicao_familiar: p.composicao_familiar ?? '',
    responsaveis: p.responsaveis ?? '',
    objetivos_terapeuticos: p.objetivos_terapeuticos ?? '',
    hiperfocos_interesses: p.hiperfocos_interesses ?? '',
    informacoes_adicionais: p.informacoes_adicionais ?? '',
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
