import type { PortalAccessLevel } from '../_shared/patient-profile.ts';

export interface GenerateInvitePayload {
  patient_id: string;
  relationship?: string;
  expires_in_hours?: number;
  access_level?: PortalAccessLevel;
  email?: string | null;
  name?: string;
}

export interface GenerateInviteResponse {
  invite_id: string;
  code: string;
  expires_at: string;
  patient_name: string;
  access_level: PortalAccessLevel;
  email_sent: boolean;
  message: string;
}
