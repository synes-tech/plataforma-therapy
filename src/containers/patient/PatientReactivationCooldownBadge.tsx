import type { ReactivationCooldownStatus } from './patient-reactivation-cooldown.utils';
import { formatAvailableDateLabel, formatCooldownBadge } from './patient-reactivation-cooldown.utils';

interface PatientReactivationCooldownBadgeProps {
  status: ReactivationCooldownStatus;
}

export function PatientReactivationCooldownBadge({ status }: PatientReactivationCooldownBadgeProps) {
  if (status.canReactivate) return null;

  const availableLabel = formatAvailableDateLabel(status.availableAt);

  return (
    <div className="inline-flex flex-col items-start gap-0.5 rounded-lg border border-amber-200/80 bg-amber-50/80 px-2.5 py-1.5">
      <p className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800">
        <span aria-hidden>🔒</span>
        {formatCooldownBadge(status)}
      </p>
      {availableLabel && (
        <p className="text-[11px] text-amber-700/90">Disponível em: {availableLabel}</p>
      )}
    </div>
  );
}
