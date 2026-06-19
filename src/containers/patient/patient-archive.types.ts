export type PatientListTab = 'active' | 'archive';

export interface ArchivedPatient {
  id: string;
  name: string;
  birth_date: string;
  diagnoses: string[];
  cpf_paciente: string | null;
  cpf_responsavel: string | null;
  nome_responsavel: string | null;
  foto_url?: string | null;
  status_vinculo: string;
  created_at: string;
  data_desvinculacao: string | null;
}

export interface ArchivedPatientsPayload {
  patients: ArchivedPatient[];
  quantidade_backup_pacientes: number;
  archived_count: number;
}
