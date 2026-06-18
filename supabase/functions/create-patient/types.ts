export interface CreatePatientPayload {
  cpf: string;
  name: string;
  birth_date: string;
  gender?: 'male' | 'female' | 'other' | 'not_informed';
  diagnoses: string[];
  clinical_observations?: string | null;
  nome_social?: string | null;
  escolaridade_ocupacao?: string | null;
  queixa_principal?: string | null;
  medicamentos?: string | null;
  acompanhamento_multi?: string[];
  composicao_familiar?: string | null;
  responsaveis?: string | null;
  objetivos_terapeuticos?: string | null;
  hiperfocos_interesses?: string | null;
  informacoes_adicionais?: string | null;
}

export interface CreatePatientResponse {
  patient_id: string;
  message: string;
}
