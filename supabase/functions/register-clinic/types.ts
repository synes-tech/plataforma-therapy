export interface RegisterClinicPayload {
  account_type: 'corporate' | 'solo';
  clinic_name?: string;
  clinic_document?: string;
  clinic_email: string;
  clinic_phone?: string;
  admin_name: string;
  admin_email: string;
  admin_password: string;
  specialty?: string;
}

export interface RegisterClinicResponse {
  clinic_id: string;
  admin_user_id: string;
  message: string;
  trial_ends_at: string;
  subscription_status: 'trialing';
}
