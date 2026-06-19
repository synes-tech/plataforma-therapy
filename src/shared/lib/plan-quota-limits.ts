/** Limites oficiais do catálogo `planos` — usado em testes e UI. */
export const OFFICIAL_PLAN_LIMITS = {
  consultorio: { professionals: 1, patientsPerProf: 50 },
  starter: { professionals: 3, patientsPerProf: 40 },
  professional: { professionals: 10, patientsPerProf: 60 },
  enterprise: { professionals: null, patientsPerProf: null },
} as const;

export type OfficialPlanId = keyof typeof OFFICIAL_PLAN_LIMITS;

export interface PlanQuotaValues {
  max_professionals: number | null;
  max_patients_per_professional: number | null;
  max_family_members_per_patient: number | null;
  max_ai_queries_per_month: number | null;
  max_audio_minutes_per_month: number | null;
}

/** Mescla cotas do `clinic_settings` com limites oficiais do catálogo quando o valor veio zerado. */
export function resolveEffectivePlanQuotas(
  planId: string,
  quotas: {
    max_professionals: number;
    max_patients_per_professional: number;
    max_family_members_per_patient: number;
    max_ai_queries_per_month: number;
    max_audio_minutes_per_month: number;
  },
): PlanQuotaValues {
  const official = OFFICIAL_PLAN_LIMITS[planId as OfficialPlanId];

  return {
    max_professionals:
      quotas.max_professionals > 0 ? quotas.max_professionals : (official?.professionals ?? null),
    max_patients_per_professional:
      quotas.max_patients_per_professional > 0
        ? quotas.max_patients_per_professional
        : (official?.patientsPerProf ?? null),
    max_family_members_per_patient:
      quotas.max_family_members_per_patient > 0 ? quotas.max_family_members_per_patient : 2,
    max_ai_queries_per_month:
      quotas.max_ai_queries_per_month > 0 ? quotas.max_ai_queries_per_month : null,
    max_audio_minutes_per_month:
      quotas.max_audio_minutes_per_month > 0 ? quotas.max_audio_minutes_per_month : null,
  };
}

/** Retorna true quando a cota já foi atingida (próxima inserção deve ser bloqueada). */
export function isQuotaExceeded(currentCount: number, limit: number | null): boolean {
  if (limit === null) return false;
  return currentCount >= limit;
}
