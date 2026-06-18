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

export function formatCooldownBadge(status: ReactivationCooldownStatus): string {
  if (status.canReactivate) return '';
  if (status.daysRemaining === 1) return 'Bloqueado. Libera em 1 dia';
  return `Bloqueado. Libera em ${status.daysRemaining} dias`;
}

export function formatAvailableDateLabel(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(date);
}
