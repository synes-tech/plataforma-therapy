/** Limite freemium — espelha backend paywall.ts */
export const FREEMIUM_PATIENT_LIMIT = 1;

export type PaywallTrigger = 'patient_limit' | 'ai_feature';

export interface PaywallBillingState {
  requires_paywall: boolean;
  patient_count: number;
  freemium_patient_limit: number;
  account_type: 'solo' | 'corporate';
  subscription_status: string;
  trial_ends_at: string | null;
}

export interface PaywallPlanCard {
  id: string;
  nome: string;
  preco_mensal_cents: number;
  descricao_curta: string | null;
  destaque: string | null;
  features: string[];
  recomendado: boolean;
}

export function shouldBlockNewPatient(state: PaywallBillingState): boolean {
  return state.requires_paywall && state.patient_count >= state.freemium_patient_limit;
}

export function shouldBlockAiFeature(state: PaywallBillingState): boolean {
  return state.requires_paywall;
}

export function plansForAccountType(
  plans: PaywallPlanCard[],
  accountType: 'solo' | 'corporate',
): PaywallPlanCard[] {
  if (accountType === 'solo') {
    return plans.filter((p) => p.id === 'consultorio');
  }
  return plans.filter((p) => p.id === 'starter' || p.id === 'professional');
}
