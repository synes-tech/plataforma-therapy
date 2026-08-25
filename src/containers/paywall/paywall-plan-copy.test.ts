/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { PAID_PLANS } from '@containers/landing/landing-content';
import { THERAPIST_PLANS } from '@shared/lib/therapist-plans';
import { overlayLandingPlanCopy, paywallCostPerPatientCents } from './paywall-plan-copy';
import type { PaywallPlanCard } from './paywall.types';

const staleStandard: PaywallPlanCard = {
  id: 'standard',
  nome: 'Plano Standard',
  preco_mensal_cents: 23700,
  preco_anual_mensal_cents: 20700,
  descricao_curta: 'legado',
  destaque: '40 sessões/mês',
  features: ['Copiloto de IA (750 interações/mês)'],
  recomendado: false,
};

describe('copy do paywall alinhada à landing', () => {
  it('substitui features de cota de IA pelo texto da landing', () => {
    const overlay = overlayLandingPlanCopy(staleStandard);
    expect(overlay.features).toEqual(PAID_PLANS[0]?.features);
    expect(overlay.features.join(' ')).not.toMatch(/interações\/mês|sessões por mês/i);
    expect(overlay.descricao_curta).toBe(PAID_PLANS[0]?.tagline);
    expect(overlay.destaque).toBeNull();
  });

  it('calcula custo por paciente pelo teto do plano', () => {
    expect(paywallCostPerPatientCents(staleStandard, 'monthly')).toBe(2370);
    expect(paywallCostPerPatientCents(staleStandard, 'yearly')).toBe(2070);
  });

  it('catálogo do terapeuta não anuncia cota de IA ou sessão', () => {
    for (const plan of Object.values(THERAPIST_PLANS)) {
      expect(plan.features.join(' ')).not.toMatch(/interações\/mês|sessões por mês/i);
    }
  });
});
