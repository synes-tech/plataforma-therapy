export interface ConfirmStripeCheckoutResponse {
  clinic_id: string;
  plan_id: string;
  subscription_status: string;
  payment_method_on_file: boolean;
  stripe_subscription_id: string | null;
}
