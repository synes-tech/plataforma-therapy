export interface PdfExportPayload {
  patient_id: string;
}

export interface PdfExportData {
  found: boolean;
  generated_at?: string;
  professional?: {
    name: string;
    email: string;
    phone: string | null;
    specialty: string | null;
    crp: string | null;
  };
  clinic?: { name: string };
  patient?: {
    id: string;
    name: string;
    birth_date: string;
    gender: string;
    diagnoses: string[];
    clinical_observations: string | null;
  };
  clinical_summary?: {
    markdown: string;
    updated_at: string;
  } | null;
}
