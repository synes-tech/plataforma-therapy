export interface SessionQuotaState {
  unlimited: boolean;
  total_used: number | null;
  total_limit: number | null;
  patient_recommended: number | null;
  blocked_total: boolean;
}

export interface AiQuotaStateView {
  unlimited: boolean;
  used: number | null;
  limit: number | null;
  warn: boolean;
  blocked: boolean;
}

export interface AddonState {
  addon_id: string;
  nome: string;
  quantidade: number;
  pacientes_bonus_per_module: number;
  billing_cycle: 'monthly' | 'yearly';
  preco_mensal_cents: number;
  preco_anual_mensal_cents: number | null;
}

export interface PlanControlStateResponse {
  clinic: {
    id: string;
    subscription_plan: string;
    subscription_status: string;
    is_solo_professional: boolean;
    trial_ends_at: string | null;
    payment_method_on_file: boolean;
    billing_cycle: 'monthly' | 'yearly';
    trial_used: boolean;
    commitment_ends_at: string | null;
    has_stripe_subscription: boolean;
    billing_exempt?: boolean;
  };
  backup: {
    quantidade_backup_pacientes: number;
    archived_count: number;
    pack_size: number;
    price_cents_per_pack: number;
  };
  patient_quota: {
    plan_base_limit: number;
    quota_bonus: number;
    total_limit: number;
    active_count: number;
    /** Módulo Adicional aplicável ao plano atual (null no FREE/legado). */
    addon: {
      addon_id: string;
      nome: string;
      pacientes_bonus: number;
      preco_mensal_cents: number;
      preco_anual_mensal_cents: number | null;
    } | null;
  } | null;
  usage: {
    sessions: SessionQuotaState | null;
    ai: AiQuotaStateView | null;
  };
  active_addons: AddonState[];
}
