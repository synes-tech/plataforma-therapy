export interface UpdateReportOutput {
  id: string;
  status: 'draft' | 'approved';
  updated_at: string;
  approved_at: string | null;
}
