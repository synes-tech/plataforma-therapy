export interface ReportItem {
  id: string;
  patient_id: string;
  patient_name: string;
  status: 'draft' | 'approved' | 'archived';
  content: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  ai_generated: boolean;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
}

export interface ListAllReportsOutput {
  items: ReportItem[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}
