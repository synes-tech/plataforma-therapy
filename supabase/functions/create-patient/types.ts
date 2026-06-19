export type CreatePatientPayload =
  | {
      possui_cpf_proprio: true;
      cpf_paciente: string;
      name: string;
      birth_date: string;
      gender?: string;
      diagnoses: string[];
      clinical_observations?: string | null;
      [key: string]: unknown;
    }
  | {
      possui_cpf_proprio: false;
      cpf_responsavel: string;
      nome_responsavel: string;
      name: string;
      birth_date: string;
      gender?: string;
      diagnoses: string[];
      clinical_observations?: string | null;
      [key: string]: unknown;
    };

export interface CreatePatientResponse {
  patient_id: string;
  message: string;
}
