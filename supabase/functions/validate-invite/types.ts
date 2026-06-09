export interface ValidateInvitePayload {
  code: string;
  name: string;
  email?: string;
  phone?: string;
}

export interface ValidateInviteResponse {
  family_member_id: string;
  patient_id: string;
  clinic_id: string;
  relationship: string;
  message: string;
}
