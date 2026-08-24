import { costPerPatientCents, formatBRL, isTherapistPlan, THERAPIST_PLANS } from '@shared/lib/therapist-plans';
import type { LandingPaidPlan } from './landing-content';

export type LandingBilling = 'mensal' | 'anual';

function catalogForLandingPlan(plan: LandingPaidPlan) {
  if (!isTherapistPlan(plan.id)) return null;
  return THERAPIST_PLANS[plan.id];
}

/** Preço do ciclo (mensal ou parcela anual) dividido pelo teto de pacientes. */
export function landingPlanCostPerPatientCents(
  plan: LandingPaidPlan,
  billing: LandingBilling,
): number {
  const catalog = catalogForLandingPlan(plan);
  if (!catalog) return 0;
  const priceCents =
    billing === 'anual' ? (catalog.yearlyMonthlyCents ?? catalog.monthlyCents) : catalog.monthlyCents;
  return costPerPatientCents(priceCents, catalog.patientLimit);
}

export function landingPlanPriceView(plan: LandingPaidPlan, billing: LandingBilling) {
  const costPerPatientValue = formatBRL(landingPlanCostPerPatientCents(plan, billing));

  if (billing === 'anual') {
    return {
      prefix: '12x',
      amount: plan.yearlyLabel,
      period: null as string | null,
      costPerPatientValue,
    };
  }

  return {
    prefix: null as string | null,
    amount: plan.monthlyLabel,
    period: '/mês',
    costPerPatientValue,
  };
}
