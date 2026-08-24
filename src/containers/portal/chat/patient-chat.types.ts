export type CompanionRiskLevel = 'LOW' | 'MODERATE' | 'SEVERE';
export type CompanionInputSource = 'text' | 'audio';

export interface PatientChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  inputSource?: CompanionInputSource;
  riskLevel?: CompanionRiskLevel;
  emergencyProtocolShown?: boolean;
  streaming?: boolean;
  createdAt: string;
}

export interface CompanionHistoryRow {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  input_source?: CompanionInputSource | null;
  risk_level?: CompanionRiskLevel | null;
  emergency_protocol_shown?: boolean | null;
  created_at: string;
}

export interface CompanionDoneMeta {
  answer: string;
  risk_level: CompanionRiskLevel | null;
  emergency_protocol_shown: boolean;
  thread_id: string | null;
  message_id: string | null;
  detector: string | null;
}
