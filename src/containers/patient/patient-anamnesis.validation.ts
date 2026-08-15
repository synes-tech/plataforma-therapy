import type { PatientAnamnesisForm } from './patient-anamnesis.types';
import { parseDiagnoses } from './patient-anamnesis.types';
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

  if (step === 1) {
    if (form.name.trim().length < 2) {
      errors.name = 'Informe o nome do paciente (mín. 2 caracteres).';
    }
    if (!form.birth_date) {
      errors.birth_date = 'Informe a data de nascimento.';
    }
    if (parseDiagnoses(form.diagnoses).length === 0) {
      errors.diagnoses = 'Informe ao menos um diagnóstico.';
    }
  }

  if (step === 5) {
    if (!form.contact_scope) {
      errors.contact_scope = 'Selecione quem terá informações de contato.';
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
