export interface CreateStripeCheckoutResponse {
  url: string;
  session_id: string;
  plan_id: string;
  price_id: string;
  mode: 'test' | 'live';
  billing_cycle: 'monthly' | 'yearly';
  trial_granted: boolean;
  trial_days: number;
}
