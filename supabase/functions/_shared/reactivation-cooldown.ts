export const REACTIVATION_COOLDOWN_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface ReactivationCooldownStatus {
  canReactivate: boolean;
  daysRemaining: number;
  availableAt: string | null;
}

export function getReactivationCooldownStatus(
  dataDesvinculacao: string | null | undefined,
  nowMs: number = Date.now(),
): ReactivationCooldownStatus {
  if (!dataDesvinculacao) {
    return { canReactivate: true, daysRemaining: 0, availableAt: null };
  }

  const unlinkedAtMs = new Date(dataDesvinculacao).getTime();
  if (Number.isNaN(unlinkedAtMs)) {
    return { canReactivate: true, daysRemaining: 0, availableAt: null };
  }

  const eligibleAtMs = unlinkedAtMs + REACTIVATION_COOLDOWN_DAYS * MS_PER_DAY;
  const remainingMs = eligibleAtMs - nowMs;

  if (remainingMs <= 0) {
    return {
      canReactivate: true,
      daysRemaining: 0,
      availableAt: new Date(eligibleAtMs).toISOString(),
    };
  }

  return {
    canReactivate: false,
    daysRemaining: Math.max(1, Math.ceil(remainingMs / MS_PER_DAY)),
    availableAt: new Date(eligibleAtMs).toISOString(),
  };
}

export function assertReactivationCooldownAllowed(
  dataDesvinculacao: string | null | undefined,
): ReactivationCooldownStatus {
  const status = getReactivationCooldownStatus(dataDesvinculacao);
  return status;
}
