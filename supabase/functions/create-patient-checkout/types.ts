export interface CreatePatientCheckoutResponse {
  url: string;
  session_id: string;
  plan_code: string;
  price_id: string;
  mode: 'test' | 'live';
  trial_days: number;
  amount_cents: number;
}
