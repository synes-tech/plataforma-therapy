export interface VerifyPatientCpfFound {
  exists: true;
  patient_id: string;
  name_masked: string;
  birth_date: string;
  status_vinculo: 'ativo' | 'desvinculado';
  data_desvinculacao?: string | null;
}

export interface VerifyPatientCpfNotFound {
  exists: false;
}

export type VerifyPatientCpfResponse = VerifyPatientCpfFound | VerifyPatientCpfNotFound;

export type CpfLookupPhase =
  | 'idle'
  | 'typing'
  | 'invalid'
  | 'searching'
  | 'not_found'
  | 'found_active'
  | 'found_backup';
