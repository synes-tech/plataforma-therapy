export type PlanId = 'consultorio' | 'starter' | 'professional' | 'enterprise';

export const PLAN_LABELS: Record<PlanId, string> = {
  consultorio: 'Consultório',
  starter: 'Clínica Starter',
  professional: 'Clínica Pro',
  enterprise: 'Enterprise',
};

export function isSoloPlan(plan: PlanId): boolean {
  return plan === 'consultorio';
}

export function getRegisterTitle(): string {
  return 'Criar meu espaço';
}

export function getClinicSectionTitle(plan: PlanId): string {
  return isSoloPlan(plan) ? '1. Dados do consultório' : '1. Dados da clínica';
}

export function getSubmitLabel(plan: PlanId): string {
  return isSoloPlan(plan) ? 'Criar meu consultório' : 'Criar minha clínica';
}
