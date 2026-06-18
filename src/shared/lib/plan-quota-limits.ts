/** Limites oficiais do catálogo `planos` — usado em testes e UI. */
export const OFFICIAL_PLAN_LIMITS = {
  consultorio: { professionals: 1, patientsPerProf: 50 },
  starter: { professionals: 3, patientsPerProf: 40 },
  professional: { professionals: 10, patientsPerProf: 60 },
  enterprise: { professionals: null, patientsPerProf: null },
} as const;

export type OfficialPlanId = keyof typeof OFFICIAL_PLAN_LIMITS;

/** Retorna true quando a cota já foi atingida (próxima inserção deve ser bloqueada). */
export function isQuotaExceeded(currentCount: number, limit: number | null): boolean {
  if (limit === null) return false;
  return currentCount >= limit;
}
