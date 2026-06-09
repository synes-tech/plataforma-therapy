export interface RegisterFamilyPayload {
  name: string;
  email: string;
  password: string;
  invite_code: string;
}

export interface RegisterFamilyResponse {
  message: string;
  patient_id: string;
  clinic_id: string;
}
