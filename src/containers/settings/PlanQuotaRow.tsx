import { PlanQuotaIncreaseButton } from './PlanQuotaIncreaseButton';

interface PlanQuotaRowProps {
  label: string;
  used: number;
  max: number | null;
  unit?: string;
  hint?: string;
  onIncrease?: () => void;
}

function formatMax(max: number | null): string {
  if (max === null || max <= 0) return 'Ilimitado';
  return String(max);
}

export function PlanQuotaRow({ label, used, max, unit = '', hint, onIncrease }: PlanQuotaRowProps) {
  const hasCap = max !== null && max > 0;
  const pct = hasCap ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const danger = hasCap && pct >= 90;

  return (
    <div className="dashboard-card-surface rounded-xl px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-charcoal">{label}</p>
          {hint && <p className="mt-0.5 text-[11px] leading-snug text-charcoal-muted">{hint}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
          <p className="text-right text-xs font-semibold tabular-nums text-charcoal">
            <span className="text-sm text-charcoal">{used}</span>
            <span className="text-charcoal-muted"> / {formatMax(max)}</span>
            {unit && <span className="text-charcoal-muted"> {unit}</span>}
          </p>
          {onIncrease && <PlanQuotaIncreaseButton onClick={onIncrease} />}
        </div>
      </div>
      {hasCap && (
        <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-white/70">
          <div
            className={`h-full rounded-full transition-all ${danger ? 'bg-error' : 'bg-primary'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

interface PlanQuotaLimitRowProps {
  label: string;
  value: string;
  hint?: string;
  onIncrease?: () => void;
}

export function PlanQuotaLimitRow({ label, value, hint, onIncrease }: PlanQuotaLimitRowProps) {
  return (
    <div className="dashboard-card-surface rounded-xl px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-charcoal">{label}</p>
          {hint && <p className="mt-0.5 text-[11px] leading-snug text-charcoal-muted">{hint}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
          <p className="text-sm font-semibold text-charcoal">{value}</p>
          {onIncrease && <PlanQuotaIncreaseButton onClick={onIncrease} />}
        </div>
      </div>
    </div>
  );
}
