export interface CancelSubscriptionPreview {
  action: 'preview';
  plan_id: string;
  plan_name: string;
  subscription_status: string;
  billing_cycle: 'monthly' | 'yearly';
  in_trial: boolean;
  /** Cancelamento imediato (trial) ou no fim do período já pago. */
  effective_at: string;
  cancels_immediately: boolean;
  /** Compromisso anual (12x) ainda vigente? */
  yearly_commitment_active: boolean;
  commitment_ends_at: string | null;
  /** Multa de fidelidade: perda retroativa do desconto de 12% nos meses usados. */
  fidelity_adjustment_cents: number;
  fidelity_months_used: number;
  requires_fidelity_acceptance: boolean;
}

export interface CancelSubscriptionResult {
  action: 'confirm';
  canceled: true;
  cancels_immediately: boolean;
  effective_at: string;
  downgraded_to_free: boolean;
  payment_methods_detached: number;
  fidelity_adjustment_cents: number;
  fidelity_invoice_id: string | null;
  fidelity_invoice_paid: boolean;
  message: string;
}

export type CancelSubscriptionResponse = CancelSubscriptionPreview | CancelSubscriptionResult;
