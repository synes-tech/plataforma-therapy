import { PAID_PLANS } from '@containers/landing/landing-content';
import { costPerPatientCents, isTherapistPlan, THERAPIST_PLANS } from '@shared/lib/therapist-plans';
import type { PaywallBillingCycle, PaywallPlanCard } from './paywall.types';

/** Aplica o copy da landing (capacidade + limite só de pacientes) no card do paywall. */
export function overlayLandingPlanCopy(plan: PaywallPlanCard): PaywallPlanCard {
  const landing = PAID_PLANS.find((item) => item.id === plan.id);
  if (!landing) return plan;

  return {
    ...plan,
    nome: landing.name,
    descricao_curta: landing.tagline,
    features: landing.features,
    destaque: null,
  };
}

export function paywallCostPerPatientCents(
  plan: PaywallPlanCard,
  cycle: PaywallBillingCycle,
): number | null {
  if (!isTherapistPlan(plan.id)) return null;
  const catalog = THERAPIST_PLANS[plan.id];
  if (!catalog || catalog.patientLimit <= 0) return null;
  const price =
    cycle === 'yearly' && plan.preco_anual_mensal_cents
      ? plan.preco_anual_mensal_cents
      : plan.preco_mensal_cents;
  return costPerPatientCents(price, catalog.patientLimit);
}

export const COST_PER_PATIENT_LABEL = 'Custo por paciente no plano';
