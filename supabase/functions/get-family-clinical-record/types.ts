export interface FamilyClinicalRecordData {
  name: string;
  nome_social: string | null;
  birth_date: string | null;
  escolaridade_ocupacao: string | null;
  diagnoses: string[];
  queixa_principal: string | null;
  medicamentos: string | null;
  acompanhamento_multi: string[];
  composicao_familiar: string | null;
  responsaveis: string | null;
  objetivos_terapeuticos: string | null;
  hiperfocos_interesses: string | null;
  informacoes_adicionais: string | null;
}

export interface GetFamilyClinicalRecordPayload {
  patient_id?: string;
}

export interface GetFamilyClinicalRecordResponse {
  patient_id: string;
  patient_name: string;
  record: FamilyClinicalRecordData;
}
