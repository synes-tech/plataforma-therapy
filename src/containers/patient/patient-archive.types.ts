export interface ArchivedPatient {
  id: string;
  name: string;
  birth_date: string;
  diagnoses: string[];
  cpf: string | null;
  foto_url?: string | null;
  created_at: string;
  data_desvinculacao?: string | null;
}

export interface ArchivedPatientsPayload {
  patients: ArchivedPatient[];
  quantidade_backup_pacientes: number;
  archived_count: number;
}

export type PatientListTab = 'active' | 'archive';
