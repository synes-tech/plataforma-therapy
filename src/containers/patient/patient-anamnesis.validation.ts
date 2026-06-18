import type { PatientAnamnesisForm } from './patient-anamnesis.types';
import { parseDiagnoses } from './patient-anamnesis.types';

export interface StepValidationResult {
  valid: boolean;
  errors: Record<string, string>;
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

  return { valid: Object.keys(errors).length === 0, errors };
}

export function canAdvanceFromStep(step: number, form: PatientAnamnesisForm): boolean {
  return validateAnamnesisStep(step, form).valid;
}

export function validateClinicalRecordForm(form: PatientAnamnesisForm): StepValidationResult {
  return validateAnamnesisStep(1, form);
}
