export interface VerifyPatientCpfPayload {
  cpf: string;
}

export interface VerifyPatientCpfMatch {
  patient_id: string;
  name_masked: string;
  birth_date: string;
  status_vinculo: 'ativo' | 'desvinculado';
  data_desvinculacao?: string | null;
  match_field: 'cpf_paciente' | 'cpf_responsavel';
}

export interface VerifyPatientCpfFound {
  exists: true;
  matches: VerifyPatientCpfMatch[];
}

export interface VerifyPatientCpfNotFound {
  exists: false;
  matches: [];
}

export type VerifyPatientCpfResponse = VerifyPatientCpfFound | VerifyPatientCpfNotFound;
