import type { PatientAnamnesisForm } from './patient-anamnesis.types';
import { parseDiagnoses, profileFromForm } from './patient-anamnesis.types';
import { anamnesisToContractForm, validateContractForm } from './patient-contract.schema';

export interface StepValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function validateAnamnesisStep(step: number, form: PatientAnamnesisForm): StepValidationResult {
  const errors: Record<string, string> = {};
  const profile = profileFromForm(form);

  if (step === 1) {
    if (form.name.trim().length < 2) {
      errors.name = 'Informe o nome do paciente (mín. 2 caracteres).';
    }
    if (!form.birth_date) {
      errors.birth_date = 'Informe a data de nascimento.';
    }
    // Catálogo ou texto livre: 64 verbetes não cobrem a clínica inteira, e o terapeuta
    // precisa poder registrar o que ainda não está lá.
    if (form.conditions.length === 0 && parseDiagnoses(form.diagnoses).length === 0) {
      errors.conditions = 'Selecione ao menos uma condição ou descreva o foco clínico.';
    }
  }

  if (step === 3) {
    // Sem responsável identificado, o portal de um menor não tem para quem ir.
    if (profile && profile !== 'ADULT') {
      if (!form.composicao_familiar.trim()) {
        errors.composicao_familiar = 'Descreva a composição e a dinâmica familiar.';
      }
      if (!form.responsaveis.trim()) {
        errors.responsaveis = 'Informe o(s) responsável(is) pelo acompanhamento.';
      }
    }
  }

  if (step === 5) {
    if (!form.contact_scope) {
      errors.contact_scope = 'Selecione quem terá acesso ao portal.';
    } else {
      if (form.contact_scope === 'patient' || form.contact_scope === 'both') {
        if (!form.email_paciente.trim()) {
          errors.email_paciente = 'Informe o e-mail do paciente.';
        } else if (!isValidEmail(form.email_paciente)) {
          errors.email_paciente = 'E-mail do paciente inválido.';
        }
      }
      if (form.contact_scope === 'responsible' || form.contact_scope === 'both') {
        if (!form.email_responsavel.trim()) {
          errors.email_responsavel = 'Informe o e-mail do responsável.';
        } else if (!isValidEmail(form.email_responsavel)) {
          errors.email_responsavel = 'E-mail do responsável inválido.';
        }
      }
    }
  }

  if (step === 6) {
    return validateContractForm(anamnesisToContractForm(form));
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function canAdvanceFromStep(step: number, form: PatientAnamnesisForm): boolean {
  return validateAnamnesisStep(step, form).valid;
}

export function validateClinicalRecordForm(form: PatientAnamnesisForm): StepValidationResult {
  return validateAnamnesisStep(1, form);
}

/** Passos que precisam ser revalidados no submit final, mesmo se o usuário pulou de volta. */
export const REQUIRED_WIZARD_STEPS = [1, 3, 5, 6] as const;
