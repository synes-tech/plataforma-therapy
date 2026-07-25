export interface PurchasePatientQuotaPackPayload {
  /** Quantidade de Módulos Adicionais (+5 pacientes cada) a acrescentar. */
  quantity: number;
}

export interface PurchasePatientQuotaPackResponse {
  professional_id: string;
  addon_id: string;
  quantity_added: number;
  total_quantity: number;
  pacientes_bonus_total: number;
  patient_quota_bonus: number;
  billing_cycle: 'monthly' | 'yearly';
  price_cents_per_module: number;
  message: string;
}
