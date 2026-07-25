export type PlanId =
  | 'free'
  | 'standard'
  | 'advanced'
  | 'premium'
  | 'inicial'
  | 'intermediario'
  | 'consultorio'
  | 'starter'
  | 'professional'
  | 'enterprise';

export const PLAN_LABELS: Record<PlanId, string> = {
  free: 'Plano Free',
  standard: 'Plano Standard',
  advanced: 'Plano Advanced',
  premium: 'Plano Premium',
  inicial: 'Plano Standard (legado)',
  intermediario: 'Plano Advanced (legado)',
  consultorio: 'Plano Standard (legado)',
  starter: 'Clínica Starter',
  professional: 'Clínica Pro',
  enterprise: 'Enterprise',
};

const SOLO_PLANS: ReadonlySet<PlanId> = new Set([
  'free',
  'standard',
  'advanced',
  'premium',
  'inicial',
  'intermediario',
  'consultorio',
]);

export function isSoloPlan(plan: PlanId): boolean {
  return SOLO_PLANS.has(plan);
}

export function getRegisterTitle(): string {
  return 'Criar meu espaço';
}

export function getClinicSectionTitle(plan: PlanId): string {
  return isSoloPlan(plan) ? '1. Seus dados profissionais' : '1. Dados da clínica';
}

export function getSubmitLabel(plan: PlanId): string {
  return isSoloPlan(plan) ? 'Criar meu consultório' : 'Criar minha clínica';
}
