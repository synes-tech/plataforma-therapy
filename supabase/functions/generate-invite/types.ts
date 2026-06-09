export interface GenerateInvitePayload {
  patient_id: string;
  relationship?: string;
  expires_in_hours?: number;
}

export interface GenerateInviteResponse {
  invite_id: string;
  code: string;
  expires_at: string;
  patient_name: string;
  message: string;
}
