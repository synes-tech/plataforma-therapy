export interface RegisterProfessionalPayload {
  name: string;
  email: string;
  password: string;
  specialty?: string;
  crp?: string;
}

export interface RegisterProfessionalResponse {
  professional_id: string;
  user_id: string;
  message: string;
}
