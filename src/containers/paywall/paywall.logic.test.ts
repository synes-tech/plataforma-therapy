/**
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
  shouldBlockNewPatient,
  shouldBlockAiFeature,
  plansForAccountType,
  type PaywallBillingState,
  type PaywallPlanCard,
} from './paywall.types';

const freeState: PaywallBillingState = {
  requires_paywall: true,
  patient_count: 0,
  freemium_patient_limit: 1,
  account_type: 'solo',
  subscription_status: 'trialing',
  subscription_plan: 'free',
  trial_ends_at: null,
  trial_used: false,
};

const makePlan = (id: string, overrides: Partial<PaywallPlanCard> = {}): PaywallPlanCard => ({
  id,
  nome: `Plano ${id}`,
  preco_mensal_cents: 10000,
  preco_anual_mensal_cents: 8800,
  descricao_curta: null,
  destaque: null,
  features: [],
  recomendado: false,
  ...overrides,
});

const samplePlans: PaywallPlanCard[] = [
  makePlan('free', { preco_mensal_cents: 0, preco_anual_mensal_cents: null }),
  makePlan('standard', { preco_mensal_cents: 23700, preco_anual_mensal_cents: 20700 }),
  makePlan('advanced', { preco_mensal_cents: 42700, preco_anual_mensal_cents: 37700, recomendado: true }),
  makePlan('premium', { preco_mensal_cents: 65700, preco_anual_mensal_cents: 57700 }),
  makePlan('starter'),
  makePlan('professional'),
];

describe('paywall v2 — planos de produção', () => {
  it('1º paciente passa no FREE (count=0)', () => {
    expect(shouldBlockNewPatient({ ...freeState, patient_count: 0 })).toBe(false);
  });

  it('2º paciente bloqueia no FREE (count>=1)', () => {
    expect(shouldBlockNewPatient({ ...freeState, patient_count: 1 })).toBe(true);
  });

  it('paciente não bloqueia com assinatura ativa', () => {
    expect(
      shouldBlockNewPatient({
        ...freeState,
        requires_paywall: false,
        patient_count: 5,
        subscription_plan: 'standard',
        subscription_status: 'active',
      }),
    ).toBe(false);
  });

  it('IA nunca é bloqueada no frontend (sem cota de interações)', () => {
    expect(shouldBlockAiFeature(freeState)).toBe(false);
    expect(shouldBlockAiFeature({ ...freeState, requires_paywall: false })).toBe(false);
  });

  it('autônomo vê Standard, Advanced e Premium (sem FREE no catálogo)', () => {
    const visible = plansForAccountType(samplePlans, 'solo');
    expect(visible.map((p) => p.id)).toEqual(['standard', 'advanced', 'premium']);
  });

  it('clínica vê Starter e Professional', () => {
    const visible = plansForAccountType(samplePlans, 'corporate');
    expect(visible.map((p) => p.id)).toEqual(['starter', 'professional']);
  });

  it('modal de planos não inclui laboratório Stripe de R$ 1', () => {
    const src = readFileSync(new URL('./PaywallModal.tsx', import.meta.url), 'utf8');
    expect(src).not.toContain('PaywallStripeTestLab');
    expect(src).not.toContain('teste_1_real');
    expect(src).not.toMatch(/TESTE 1 REAL/i);
  });
});
