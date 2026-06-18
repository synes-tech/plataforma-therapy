export interface ProcessCheckoutBypassPayload {
  plan_id: string;
  /** Enviado pelo frontend para UX; nunca persistido (bypass). */
  card_holder_name?: string;
  card_number?: string;
  card_expiry?: string;
  card_cvv?: string;
}

export interface ProcessCheckoutBypassResponse {
  clinic_id: string;
  plan_id: string;
  subscription_status: 'trial_active';
  payment_method_on_file: true;
  trial_ends_at: string;
}
