export interface ArchivedPatientRow {
  id: string;
  name: string;
  birth_date: string;
  diagnoses: string[];
  cpf_paciente: string | null;
  cpf_responsavel: string | null;
  nome_responsavel: string | null;
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
