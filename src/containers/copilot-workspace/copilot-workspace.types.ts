export interface WorkspacePatient {
  id: string;
  name: string;
  birth_date?: string | null;
  diagnoses?: string[];
  foto_url?: string | null;
}
