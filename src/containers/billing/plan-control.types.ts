import type { AddonCatalogInfo } from './billing-patient-pack.utils';

export interface PlanControlState {
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
    addon: AddonCatalogInfo | null;
  } | null;
  usage: {
    sessions: {
      unlimited: boolean;
      total_used: number | null;
      total_limit: number | null;
      patient_recommended: number | null;
      blocked_total: boolean;
    } | null;
    ai: {
      unlimited: boolean;
      used: number | null;
      limit: number | null;
      warn: boolean;
      blocked: boolean;
    } | null;
  };
  active_addons: Array<{
    addon_id: string;
    nome: string;
    quantidade: number;
    pacientes_bonus_per_module: number;
    billing_cycle: 'monthly' | 'yearly';
    preco_mensal_cents: number;
    preco_anual_mensal_cents: number | null;
  }>;
}
