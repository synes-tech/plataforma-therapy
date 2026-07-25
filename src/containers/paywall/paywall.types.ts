/** Limite do plano FREE — espelha backend paywall.ts */
export const FREEMIUM_PATIENT_LIMIT = 1;

export type PaywallTrigger = 'patient_limit' | 'ai_feature' | 'plan_catalog';

export type PaywallBillingCycle = 'monthly' | 'yearly';

export interface PaywallBillingState {
  requires_paywall: boolean;
  patient_count: number;
  freemium_patient_limit: number;
  account_type: 'solo' | 'corporate';
  subscription_status: string;
  subscription_plan: string;
  trial_ends_at: string | null;
  trial_used: boolean;
}

export interface PaywallPlanCard {
  id: string;
  nome: string;
  preco_mensal_cents: number;
  preco_anual_mensal_cents: number | null;
  descricao_curta: string | null;
  destaque: string | null;
  features: string[];
  recomendado: boolean;
}

export function shouldBlockNewPatient(state: PaywallBillingState): boolean {
  return state.requires_paywall && state.patient_count >= state.freemium_patient_limit;
}

/**
 * v2: IA não é mais bloqueada preventivamente no frontend.
 * Todos os planos (inclusive FREE) têm cota mensal de interações;
 * o backend responde 402 AI_QUOTA_EXCEEDED quando a cota esgota.
 */
export function shouldBlockAiFeature(_state: PaywallBillingState): boolean {
  return false;
}

const SOLO_PAID_PLAN_IDS = ['standard', 'advanced', 'premium'];

export function plansForAccountType(
  plans: PaywallPlanCard[],
  accountType: 'solo' | 'corporate',
): PaywallPlanCard[] {
  if (accountType === 'solo') {
    return plans.filter((p) => SOLO_PAID_PLAN_IDS.includes(p.id));
  }
  return plans.filter((p) => p.id === 'starter' || p.id === 'professional');
}
