export type StripeBillingMode = 'test' | 'live';
export type StripeCheckoutPlanId = 'inicial' | 'intermediario' | 'teste_1_real';

/** @deprecated use StripeCheckoutPlanId */
export type StripeTherapistPlanId = StripeCheckoutPlanId;

export interface StripePlanDefinition {
  id: StripeCheckoutPlanId;
  name: string;
  priceLabel: string;
  billingInterval: 'month' | 'once';
  description: string;
  productIdLive?: string;
  liveOnly?: boolean;
}

export const STRIPE_SUBSCRIPTION_PLANS: StripePlanDefinition[] = [
  {
    id: 'inicial',
    name: 'Plano Inicial',
    priceLabel: 'R$ 150',
    billingInterval: 'month',
    description: 'Até 10 pacientes ativos',
    productIdLive: 'prod_Utlu7cfq4TY1lp',
  },
  {
    id: 'intermediario',
    name: 'Plano Intermediário',
    priceLabel: 'R$ 300',
    billingInterval: 'month',
    description: 'Até 40 pacientes ativos',
    productIdLive: 'prod_Utlv6MsaI79XxC',
  },
];

export const STRIPE_LIVE_ONLY_PLANS: StripePlanDefinition[] = [
  {
    id: 'teste_1_real',
    name: 'TESTE 1 REAL',
    priceLabel: 'R$ 1',
    billingInterval: 'once',
    description: 'Pagamento único real — ideal para validar checkout em produção',
    productIdLive: 'prod_UtmLX78ZOcMvz5',
    liveOnly: true,
  },
];

export const STRIPE_TEST_CARDS = [
  { label: 'Pagamento aprovado', number: '4242 4242 4242 4242' },
  { label: 'Requer 3DS', number: '4000 0025 0000 3155' },
  { label: 'Pagamento recusado', number: '4000 0000 0000 9995' },
] as const;

export function plansForBillingMode(mode: StripeBillingMode): StripePlanDefinition[] {
  if (mode === 'test') return STRIPE_SUBSCRIPTION_PLANS;
  return [...STRIPE_LIVE_ONLY_PLANS, ...STRIPE_SUBSCRIPTION_PLANS];
}

export function planById(planId: StripeCheckoutPlanId): StripePlanDefinition {
  const plan = [...STRIPE_SUBSCRIPTION_PLANS, ...STRIPE_LIVE_ONLY_PLANS].find((p) => p.id === planId);
  if (!plan) throw new Error(`Plano desconhecido: ${planId}`);
  return plan;
}

export function modeLabel(mode: StripeBillingMode): string {
  return mode === 'test' ? 'Modo teste (Stripe Sandbox)' : 'Modo produção (cobrança real)';
}

export function priceSuffix(plan: StripePlanDefinition): string {
  return plan.billingInterval === 'month' ? '/mês' : ' · pagamento único';
}
