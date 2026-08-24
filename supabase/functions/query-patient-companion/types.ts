import type { ClinicalRiskLevel } from '../_shared/patient-profile.ts';
import type { RiskDetector } from '../_shared/companion/risk-merge.ts';

export interface QueryPatientCompanionResponse {
  thread_id: string;
  message_id: string;
  answer: string;
  risk_level: ClinicalRiskLevel;
  emergency_protocol_shown: boolean;
  detector: RiskDetector;
}
