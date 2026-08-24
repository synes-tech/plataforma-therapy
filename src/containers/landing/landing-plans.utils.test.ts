import { describe, expect, it } from 'vitest';
import { formatBRL } from '@shared/lib/therapist-plans';
import { PAID_PLANS } from './landing-content';
import { landingPlanCostPerPatientCents, landingPlanPriceView } from './landing-plans.utils';

describe('vitrine de planos da landing', () => {
  it('mostra o anual em 12x da parcela, sem /mês e sem total', () => {
    const view = landingPlanPriceView(PAID_PLANS[0]!, 'anual');
    expect(view.prefix).toBe('12x');
    expect(view.amount).toBe('R$ 207,00');
    expect(view.period).toBeNull();
  });

  it('mostra o mensal com /mês quando o check anual é desligado', () => {
    const view = landingPlanPriceView(PAID_PLANS[1]!, 'mensal');
    expect(view.prefix).toBeNull();
    expect(view.amount).toBe('R$ 427,00');
    expect(view.period).toBe('/mês');
  });

  it('divide o valor mensal pelo teto de pacientes do plano', () => {
    const [standard, advanced, premium] = PAID_PLANS;
    expect(landingPlanCostPerPatientCents(standard!, 'mensal')).toBe(2370);
    expect(landingPlanCostPerPatientCents(advanced!, 'mensal')).toBe(2135);
    expect(landingPlanCostPerPatientCents(premium!, 'mensal')).toBe(2190);
    expect(landingPlanPriceView(standard!, 'mensal').costPerPatientValue).toBe(formatBRL(2370));
    expect(landingPlanPriceView(advanced!, 'mensal').costPerPatientValue).toBe(formatBRL(2135));
    expect(landingPlanPriceView(premium!, 'mensal').costPerPatientValue).toBe(formatBRL(2190));
  });

  it('divide a parcela anual pelo mesmo teto de pacientes', () => {
    const [standard, advanced, premium] = PAID_PLANS;
    expect(landingPlanCostPerPatientCents(standard!, 'anual')).toBe(2070);
    expect(landingPlanCostPerPatientCents(advanced!, 'anual')).toBe(1885);
    expect(landingPlanCostPerPatientCents(premium!, 'anual')).toBe(1923);
    expect(landingPlanPriceView(standard!, 'anual').costPerPatientValue).toBe(formatBRL(2070));
    expect(landingPlanPriceView(advanced!, 'anual').costPerPatientValue).toBe(formatBRL(1885));
    expect(landingPlanPriceView(premium!, 'anual').costPerPatientValue).toBe(formatBRL(1923));
  });
});
