/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  shouldBlockNewPatient,
  shouldBlockAiFeature,
  plansForAccountType,
  type PaywallBillingState,
  type PaywallPlanCard,
} from './paywall.types';

const trialingState: PaywallBillingState = {
  requires_paywall: true,
  patient_count: 0,
  freemium_patient_limit: 1,
  account_type: 'solo',
  subscription_status: 'trialing',
  trial_ends_at: '2026-07-01T00:00:00Z',
};

const samplePlans: PaywallPlanCard[] = [
  {
    id: 'consultorio',
    nome: 'Consultório',
    preco_mensal_cents: 14700,
    descricao_curta: 'Autônomo',
    destaque: null,
    features: [],
    recomendado: false,
  },
  {
    id: 'starter',
    nome: 'Starter',
    preco_mensal_cents: 39700,
    descricao_curta: 'Clínica',
    destaque: null,
    features: [],
    recomendado: false,
  },
  {
    id: 'professional',
    nome: 'Pro',
    preco_mensal_cents: 99700,
    descricao_curta: 'Clínica',
    destaque: null,
    features: [],
    recomendado: true,
  },
];

describe('paywall — caminho feliz', () => {
  it('1º paciente passa (count=0)', () => {
    expect(shouldBlockNewPatient({ ...trialingState, patient_count: 0 })).toBe(false);
  });

  it('2º paciente bloqueia (count>=1)', () => {
    expect(shouldBlockNewPatient({ ...trialingState, patient_count: 1 })).toBe(true);
  });

  it('IA bloqueia em trial sem cartão', () => {
    expect(shouldBlockAiFeature(trialingState)).toBe(true);
  });

  it('IA libera quando assinatura validada', () => {
    expect(shouldBlockAiFeature({ ...trialingState, requires_paywall: false })).toBe(false);
  });

  it('trial_active não exige paywall (via API)', () => {
    expect(
      shouldBlockAiFeature({
        ...trialingState,
        requires_paywall: false,
        subscription_status: 'trial_active',
      }),
    ).toBe(false);
  });

  it('autônomo vê só Consultório', () => {
    const visible = plansForAccountType(samplePlans, 'solo');
    expect(visible.map((p) => p.id)).toEqual(['consultorio']);
  });

  it('clínica vê Starter e Pro', () => {
    const visible = plansForAccountType(samplePlans, 'corporate');
    expect(visible.map((p) => p.id)).toEqual(['starter', 'professional']);
  });
});
