export interface CreatePatientPayload {
  name: string;
  birth_date: string;
  gender?: 'male' | 'female' | 'other' | 'not_informed';
  diagnoses: string[];
  clinical_observations?: string;
}

export interface CreatePatientResponse {
  patient_id: string;
  message: string;
}
