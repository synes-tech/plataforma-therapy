export interface ArchivedPatientRow {
  id: string;
  name: string;
  birth_date: string;
  diagnoses: string[];
  cpf: string | null;
  foto_url: string | null;
  status_vinculo: 'desvinculado';
  created_at: string;
  data_desvinculacao: string | null;
}

export interface GetArchivedPatientsResponse {
  patients: ArchivedPatientRow[];
  quantidade_backup_pacientes: number;
  archived_count: number;
}
