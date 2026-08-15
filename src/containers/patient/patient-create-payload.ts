import type { PatientCreateIdentity } from './patient-cpf.types';
import { parseDiagnoses, type PatientAnamnesisForm } from './patient-anamnesis.types';

export type CreatePatientPayload =
  | ({
      possui_cpf_proprio: true;
      cpf_paciente: string;
    } & ReturnType<typeof anamnesisFieldsFromForm>)
  | ({
      possui_cpf_proprio: false;
      cpf_responsavel: string;
      nome_responsavel: string;
    } & ReturnType<typeof anamnesisFieldsFromForm>);

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
    contact_scope: form.contact_scope || undefined,
    email_paciente: form.email_paciente.trim() || undefined,
    telefone_paciente: form.telefone_paciente.replace(/\D/g, '') || undefined,
    email_responsavel: form.email_responsavel.trim() || undefined,
    telefone_responsavel: form.telefone_responsavel.replace(/\D/g, '') || undefined,
    financeiro_model_type: form.financeiro_model_type || undefined,
    financeiro_billing_type: form.financeiro_billing_type || undefined,
    financeiro_valor_acordado_cents: form.financeiro_billing_type
      ? Math.round(
          Number(
            form.financeiro_valor_sessao
              .replace(/\s/g, '')
              .replace('R$', '')
              .replace(/\./g, '')
              .replace(',', '.'),
          ) * 100,
        ) || 0
      : undefined,
    financeiro_due_day:
      form.financeiro_billing_type === 'MENSAL_RECORRENTE'
        ? Number(form.financeiro_due_day) || undefined
        : undefined,
    financeiro_sessions_per_month: form.financeiro_sessions_custom
      ? undefined
      : Number(form.financeiro_sessions_per_month) || undefined,
    financeiro_sessions_custom: form.financeiro_sessions_custom || undefined,
    financeiro_contract_duration_months: Number(form.financeiro_duration_months) || undefined,
    financeiro_modelo:
      form.financeiro_billing_type === 'PACOTE'
        ? 'pacote'
        : form.financeiro_billing_type
          ? 'avulso'
          : undefined,
    financeiro_valor_sessao_cents: form.financeiro_billing_type
      ? Math.round(
          Number(
            form.financeiro_valor_sessao
              .replace(/\s/g, '')
              .replace('R$', '')
              .replace(/\./g, '')
              .replace(',', '.'),
          ) * 100,
        ) || 0
      : undefined,
    financeiro_pacote_qtd_sessoes:
      form.financeiro_billing_type === 'PACOTE' ? Number(form.financeiro_pacote_qtd) || undefined : undefined,
    financeiro_pacote_valor_cents:
      form.financeiro_billing_type === 'PACOTE'
        ? Math.round(
            Number(
              form.financeiro_pacote_valor
                .replace(/\s/g, '')
                .replace('R$', '')
                .replace(/\./g, '')
                .replace(',', '.'),
            ) * 100,
          ) || 0
        : undefined,
    financeiro_registrar_pacote_pago:
      form.financeiro_billing_type === 'PACOTE' ? form.financeiro_registrar_pacote_pago : undefined,
    financeiro_observacoes: form.financeiro_observacoes.trim() || undefined,
  };
}

export function formToCreatePayload(
  form: PatientAnamnesisForm,
  identity: PatientCreateIdentity,
): CreatePatientPayload {
  const base = anamnesisFieldsFromForm(form);

  if (identity.mode === 'own_cpf') {
    return {
      possui_cpf_proprio: true,
      cpf_paciente: identity.cpfPaciente,
      ...base,
    };
  }

  return {
    possui_cpf_proprio: false,
    cpf_responsavel: identity.cpfResponsavel,
    nome_responsavel: identity.nomeResponsavel.trim(),
    ...base,
  };
}

export function lookupCpfFromIdentity(identity: PatientCreateIdentity): string {
  return identity.mode === 'own_cpf' ? identity.cpfPaciente : identity.cpfResponsavel;
}

export function clearIdentityForMode(
  mode: PatientCreateIdentity['mode'],
): Pick<PatientCreateIdentity, 'cpfPaciente' | 'cpfResponsavel' | 'nomeResponsavel'> {
  if (mode === 'own_cpf') {
    return { cpfPaciente: '', cpfResponsavel: '', nomeResponsavel: '' };
  }
  return { cpfPaciente: '', cpfResponsavel: '', nomeResponsavel: '' };
}
