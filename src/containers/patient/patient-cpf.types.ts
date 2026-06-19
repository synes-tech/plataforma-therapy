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
  matches?: [];
}

export type VerifyPatientCpfResponse = VerifyPatientCpfFound | VerifyPatientCpfNotFound;

export type CpfLookupPhase =
  | 'idle'
  | 'typing'
  | 'invalid'
  | 'searching'
  | 'not_found'
  | 'found_active'
  | 'found_backup'
  | 'found_multiple';

export type PatientIdentityMode = 'own_cpf' | 'dependent';

export interface PatientCreateIdentity {
  mode: PatientIdentityMode;
  cpfPaciente: string;
  cpfResponsavel: string;
  nomeResponsavel: string;
}

export const EMPTY_CREATE_IDENTITY: PatientCreateIdentity = {
  mode: 'own_cpf',
  cpfPaciente: '',
  cpfResponsavel: '',
  nomeResponsavel: '',
};
