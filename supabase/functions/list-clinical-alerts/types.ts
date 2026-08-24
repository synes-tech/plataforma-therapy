import type { ClinicalRiskLevel } from '../_shared/patient-profile.ts';

export interface ClinicalAlertItem {
  id: string;
  patient_id: string;
  patient_name: string;
  patient_foto_url: string | null;
  clinic_id: string;
  professional_id: string | null;
  source: string;
  severity: ClinicalRiskLevel;
  status: 'UNREAD' | 'ACKNOWLEDGED' | 'RESOLVED';
  title: string;
  summary: string;
  source_ref_id: string | null;
  occurred_at: string;
  notify_now: boolean;
  metadata: Record<string, unknown>;
}

export interface ListClinicalAlertsResponse {
  alerts: ClinicalAlertItem[];
  unread_count: number;
  severe_unread_count: number;
  has_severe_unread: boolean;
}
