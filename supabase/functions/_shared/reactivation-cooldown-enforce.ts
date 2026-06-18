import { AppError } from './errors.ts';
import {
  assertReactivationCooldownAllowed,
  type ReactivationCooldownStatus,
} from './reactivation-cooldown.ts';

export function enforceReactivationCooldown(
  dataDesvinculacao: string | null | undefined,
): ReactivationCooldownStatus {
  const status = assertReactivationCooldownAllowed(dataDesvinculacao);

  if (!status.canReactivate) {
    const availableLabel = status.availableAt
      ? new Date(status.availableAt).toLocaleDateString('pt-BR')
      : null;

    throw new AppError({
      code: 'REACTIVATION_COOLDOWN',
      message: availableLabel
        ? `Reativação bloqueada por segurança. Faltam ${status.daysRemaining} dia(s) (disponível em ${availableLabel}).`
        : `Reativação bloqueada por segurança. Faltam ${status.daysRemaining} dia(s) para liberação.`,
      statusCode: 403,
      details: {
        days_remaining: status.daysRemaining,
        available_at: status.availableAt,
      },
    });
  }

  return status;
}
