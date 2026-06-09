export interface RegisterClinicPayload {
  clinic_name: string;
  clinic_document?: string;
  clinic_email: string;
  clinic_phone?: string;
  admin_name: string;
  admin_email: string;
  admin_password: string;
  plan?: 'consultorio' | 'starter' | 'professional' | 'enterprise';
  specialty?: string;
}

export interface RegisterClinicResponse {
  clinic_id: string;
  admin_user_id: string;
  message: string;
}
